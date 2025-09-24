import { FactCheckReport } from '../types';

interface CacheEntry {
    data: FactCheckReport;
    timestamp: number;
}

/**
 * A simple in-memory cache for storing fact-check results to avoid redundant API calls.
 */
export class FactCheckCache {
    private cache: Map<string, CacheEntry> = new Map();
    private ttl: number; // Time-to-Live in milliseconds

    /**
     * @param ttl - The default Time-to-Live for cache entries, in milliseconds. Defaults to 1 hour.
     */
    constructor(ttl: number = 3600000) { // 1 hour = 60 * 60 * 1000 ms
        this.ttl = ttl;
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
