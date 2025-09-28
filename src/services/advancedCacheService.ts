interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiryTime: number;
  hitCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  factCheckTTL: number;      // 24 hours
  webSearchTTL: number;      // 1 hour
  temporalTTL: number;       // 12 hours
  serpApiTTL: number;        // 1 hour
  maxMemoryEntries: number;  // 1000 entries
}

export class AdvancedCacheService {
  private static instance: AdvancedCacheService;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig = {
    factCheckTTL: 24 * 60 * 60 * 1000,    // 24 hours
    webSearchTTL: 60 * 60 * 1000,         // 1 hour
    temporalTTL: 12 * 60 * 60 * 1000,     // 12 hours
    serpApiTTL: 60 * 60 * 1000,           // 1 hour
    maxMemoryEntries: 1000
  };

  static getInstance(): AdvancedCacheService {
    if (!AdvancedCacheService.instance) {
      AdvancedCacheService.instance = new AdvancedCacheService();
    }
    return AdvancedCacheService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && Date.now() < memoryEntry.expiryTime) {
      memoryEntry.hitCount++;
      memoryEntry.lastAccessed = Date.now();
      return memoryEntry.data;
    }

    // Try localStorage fallback
    try {
      const localData = localStorage.getItem(`cache_${key}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Date.now() < parsed.expiryTime) {
          // Move back to memory cache
          this.memoryCache.set(key, {
            data: parsed.data,
            timestamp: parsed.timestamp,
            expiryTime: parsed.expiryTime,
            hitCount: parsed.hitCount + 1,
            lastAccessed: Date.now()
          });
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('LocalStorage cache read failed:', error);
    }

    return null;
  }

  async set<T>(key: string, data: T, cacheType: keyof CacheConfig): Promise<void> {
    const ttl = this.config[cacheType];
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiryTime: Date.now() + ttl,
      hitCount: 0,
      lastAccessed: Date.now()
    };

    // Add to memory cache
    this.memoryCache.set(key, entry);

    // Cleanup if needed
    if (this.memoryCache.size > this.config.maxMemoryEntries) {
      this.cleanup();
    }

    // Fallback to localStorage for persistence
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('LocalStorage cache write failed:', error);
    }
  }

  private cleanup(): void {
    // Remove expired entries first
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiryTime) {
        this.memoryCache.delete(key);
        localStorage.removeItem(`cache_${key}`);
      }
    }

    // If still over limit, remove least recently used
    if (this.memoryCache.size > this.config.maxMemoryEntries) {
      const entries = Array.from(this.memoryCache.entries())
        .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);

      const toRemove = entries.slice(0, entries.length - this.config.maxMemoryEntries);
      toRemove.forEach(([key]) => {
        this.memoryCache.delete(key);
        localStorage.removeItem(`cache_${key}`);
      });
    }
  }

  generateKey(...parts: string[]): string {
    return parts.join('::').replace(/[^a-zA-Z0-9:_-]/g, '_');
  }

  clearExpired(): void {
    this.cleanup();
  }

  getStats(): { totalEntries: number, hitRates: Record<string, number> } {
    const stats = { totalEntries: this.memoryCache.size, hitRates: {} as Record<string, number> };

    for (const [key, entry] of this.memoryCache.entries()) {
      const category = key.split('::')[0];
      if (!stats.hitRates[category]) {
        stats.hitRates[category] = 0;
      }
      stats.hitRates[category] += entry.hitCount;
    }

    return stats;
  }

  async fetchAllFromLocalStorage(): Promise<[string, any][]> {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const entries: [string, any][] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
            const rawData = localStorage.getItem(key);
            if (rawData) {
                try {
                    const parsed = JSON.parse(rawData);
                    if (Date.now() < parsed.expiryTime) {
                        entries.push([key.replace('cache_', ''), parsed]);
                    } else {
                        localStorage.removeItem(key);
                    }
                } catch { /* ignore */ }
            }
        }
    }
    return entries;
  }
}