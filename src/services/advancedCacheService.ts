// src/services/advancedCacheService.ts - Fixed version
import { FactCheckReport } from '../types/factCheck';

interface CacheEntry {
  data: FactCheckReport;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  persistKey: string;
}

export class AdvancedCacheService {
  private static instance: AdvancedCacheService;
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private persistenceEnabled: boolean;

  private constructor() {
    this.cache = new Map();
    this.config = {
      maxSize: 100,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      persistKey: 'truscope_factcheck_cache'
    };
    this.persistenceEnabled = this.checkPersistenceAvailability();
    this.hydrateFromPersistence();
  }

  static getInstance(): AdvancedCacheService {
    if (!AdvancedCacheService.instance) {
      AdvancedCacheService.instance = new AdvancedCacheService();
    }
    return AdvancedCacheService.instance;
  }

  private checkPersistenceAvailability(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('⚠️ localStorage not available - cache persistence disabled');
        return false;
      }
      // Test if localStorage is actually writable
      const testKey = '__cache_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.warn('⚠️ localStorage access denied - cache persistence disabled');
      return false;
    }
  }

  private hydrateFromPersistence(): void {
    if (!this.persistenceEnabled) {
      console.log('ℹ️ Cache persistence disabled - starting with empty cache');
      return;
    }

    try {
      console.log('🔄 Hydrating fact-check cache from persistent storage...');
      const stored = localStorage.getItem(this.config.persistKey);

      if (!stored) {
        console.log('ℹ️ No cached data found in storage');
        return;
      }

      const parsed = JSON.parse(stored);
      const now = Date.now();
      let loadedCount = 0;
      let expiredCount = 0;

      if (Array.isArray(parsed)) {
        parsed.forEach(([key, entry]: [string, CacheEntry]) => {
          // Check if entry is still valid
          if (now - entry.timestamp < this.config.ttl) {
            this.cache.set(key, entry);
            loadedCount++;
          } else {
            expiredCount++;
          }
        });
      }

      console.log(`✅ Cache hydration complete. Loaded ${loadedCount} entries (${expiredCount} expired)`);
    } catch (error) {
      console.error('❌ Failed to hydrate cache:', error);
      // Clear corrupted cache
      if (this.persistenceEnabled) {
        try {
          localStorage.removeItem(this.config.persistKey);
        } catch (e) {
          console.error('Failed to clear corrupted cache:', e);
        }
      }
    }
  }

  private persistToStorage(): void {
    if (!this.persistenceEnabled) {
      return;
    }

    try {
      const entries = Array.from(this.cache.entries());
      const serialized = JSON.stringify(entries);

      // Check size before saving (localStorage has ~5-10MB limit)
      if (serialized.length > 5 * 1024 * 1024) {
        console.warn('⚠️ Cache too large, performing cleanup...');
        this.cleanup();
        return;
      }

      localStorage.setItem(this.config.persistKey, serialized);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('⚠️ Storage quota exceeded, clearing old entries...');
        this.cleanup();
      } else {
        console.error('❌ Failed to persist cache:', error);
      }
    }
  }

  set(key: string, data: FactCheckReport): void {
    const now = Date.now();

    // If cache is full, remove least recently used entry
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    });

    this.persistToStorage();
  }

  get(key: string): FactCheckReport | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    // Check if entry has expired
    if (now - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.persistToStorage();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.cache.set(key, entry);

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > this.config.ttl) {
      this.cache.delete(key);
      this.persistToStorage();
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.persistToStorage();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    if (this.persistenceEnabled) {
      try {
        localStorage.removeItem(this.config.persistKey);
      } catch (error) {
        console.error('Failed to clear persisted cache:', error);
      }
    }
    console.log('🗑️ Cache cleared');
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log('🗑️ Evicted LRU entry:', oldestKey.substring(0, 20) + '...');
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));

    // If still too large, remove least accessed entries
    if (this.cache.size > this.config.maxSize * 0.75) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

      const toRemove = Math.floor(this.config.maxSize * 0.25);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.persistToStorage();
    console.log(`🧹 Cache cleanup complete. Current size: ${this.cache.size}`);
  }

  getStats() {
    const now = Date.now();
    let totalAccesses = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      if (now - entry.timestamp < this.config.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      size: this.cache.size,
      validEntries,
      expiredEntries,
      totalAccesses,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      persistenceEnabled: this.persistenceEnabled
    };
  }

  // Periodically clean up expired entries
  startCleanupInterval(intervalMs: number = 60 * 60 * 1000): void {
    setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }
}

// Initialize cleanup interval when module loads
if (typeof window !== 'undefined') {
  const cache = AdvancedCacheService.getInstance();
  cache.startCleanupInterval();
}