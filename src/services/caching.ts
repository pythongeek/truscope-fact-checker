import { FactCheckReport } from '@/types/factCheck';
import { AdvancedCacheService } from './advancedCacheService';

const advancedCache = AdvancedCacheService.getInstance();

interface CacheEntry {
    data: FactCheckReport;
    timestamp: number;
}

/**
 * A simple in-memory cache that is asynchronously hydrated from and writes-through to a more persistent cache.
 */
export class FactCheckCache {
    private cache: Map<string, CacheEntry> = new Map();
    private ttl: number; // Time-to-Live in milliseconds
    private isHydrated: boolean = false;

    /**
     * @param ttl - The default Time-to-Live for cache entries, in milliseconds. Defaults to 1 hour.
     */
    constructor(ttl: number = 3600000) { // 1 hour = 60 * 60 * 1000 ms
        this.ttl = ttl;
        this._hydrateCache();
    }

    private async _hydrateCache(): Promise<void> {
        if (typeof localStorage === 'undefined') {
            this.isHydrated = true;
            return;
        }
        try {
            console.log('Hydrating fact-check cache from persistent storage...');
            const persistedEntries = await advancedCache.fetchAllFromLocalStorage();
            for (const [key, entry] of persistedEntries) {
                // Hydrate all valid entries into the in-memory cache
                this.cache.set(key, {
                    data: entry.data,
                    timestamp: entry.timestamp
                });
            }
            this.isHydrated = true;
            console.log(`Cache hydration complete. Loaded ${persistedEntries.length} entries.`);
        } catch (error) {
            console.warn('Cache hydration failed:', error);
            // Mark as hydrated even on failure to avoid blocking gets
            this.isHydrated = true;
        }
    }

    /**
     * Retrieves a fact-check report from the cache if it exists and has not expired.
     * @param key - The unique key for the cache entry.
     * @returns The cached FactCheckReport or null if not found or expired.
     */
    get(key: string): FactCheckReport | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null; // Cache miss
        }

        const isExpired = (Date.now() - entry.timestamp) > this.ttl;

        if (isExpired) {
            this.cache.delete(key); // Remove expired entry
            return null;
        }

        return entry.data;
    }

    /**
     * Stores a fact-check report in the cache with a timestamp.
     * @param key - The unique key for the cache entry.
     * @param data - The FactCheckReport to store.
     */
    set(key: string, data: FactCheckReport): void {
        const entry: CacheEntry = {
            data,
            timestamp: Date.now(),
        };
        this.cache.set(key, entry);

        // Asynchronously write to the advanced cache without blocking.
        // This is a "fire and forget" operation to avoid breaking the synchronous interface.
        advancedCache.set(key, data, 'factCheckTTL').catch(err => {
            console.warn('Advanced cache write-through failed:', err);
        });
    }

    /**
     * Clears the entire cache.
     */
    clear(): void {
        this.cache.clear();
    }
}

// Export a singleton instance to be used throughout the application
export const factCheckCache = new FactCheckCache();

const cacheService = AdvancedCacheService.getInstance();

/**
 * Retrieves an item from the cache.
 * @param key The cache key.
 * @returns The cached data or null if not found.
 */
export async function getCache(key: string): Promise<any | null> {
    return await cacheService.get(key);
}

/**
 * Stores an item in the cache.
 * @param key The cache key.
 * @param data The data to store.
 * @param ttl The time-to-live for the cache entry in seconds.
 */
export async function setCache(key: string, data: any, ttlInSeconds: number): Promise<void> {
    // AdvancedCacheService expects a cache type, not a raw TTL.
    // This is a simplified mapping. For a real scenario, you might adjust AdvancedCacheService.
    // We'll use 'webSearchTTL' as a generic TTL type for this purpose.
    // A more robust implementation might involve modifying AdvancedCacheService to accept raw TTLs.

    // Find the closest TTL configuration
    let cacheType: 'factCheckTTL' | 'webSearchTTL' | 'temporalTTL' | 'serpApiTTL' = 'webSearchTTL';
    if (ttlInSeconds > 23 * 3600) { // ~24 hours
        cacheType = 'factCheckTTL';
    } else if (ttlInSeconds > 11 * 3600) { // ~12 hours
        cacheType = 'temporalTTL';
    } else if (ttlInSeconds > 30 * 60) { // ~1 hour
        cacheType = 'serpApiTTL';
    }

    await cacheService.set(key, data, cacheType);
}
