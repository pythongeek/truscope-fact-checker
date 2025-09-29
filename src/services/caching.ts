import { AdvancedCacheService } from './advancedCacheService';

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