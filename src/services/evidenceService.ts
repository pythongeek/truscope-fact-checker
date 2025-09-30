// src/services/evidenceService.ts

import { EvidenceItem } from '../types';
import { fetchGoogleSearchEvidence } from './googleSearchService';

/**
 * Fetches evidence from a specific backend API proxy.
 * @param endpoint - The API endpoint URL (e.g., '/api/serp-search').
 * @param query - The search query.
 * @returns A promise that resolves to an array of EvidenceItem objects.
 */
async function fetchFromProxy(endpoint: string, query: string): Promise<EvidenceItem[]> {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.details || `Request to ${endpoint} failed`);
        }
        const data = await response.json();
        return data.evidence || [];
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error);
        return []; // Return empty on error to not break the entire flow
    }
}

/**
 * Fetches and aggregates evidence from all configured sources.
 * @param query - The search query.
 * @returns A promise that resolves to a single, combined array of all evidence.
 */
export async function fetchAllEvidence(query: string): Promise<EvidenceItem[]> {
    // All API calls are initiated in parallel
    const promises = [
        fetchFromProxy('/api/serp-search', query),
        fetchFromProxy('/api/newsdata-search', query),
        fetchGoogleSearchEvidence(query), // Frontend call
    ];

    // Wait for all promises to settle (either resolve or reject)
    const results = await Promise.allSettled(promises);

    // Flatten the results from all successful calls into a single array
    const allEvidence = results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => (result as PromiseFulfilledResult<EvidenceItem[]>).value);

    return allEvidence;
}
