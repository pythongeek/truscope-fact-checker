// src/services/googleSearchService.ts

import { EvidenceItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

// IMPORTANT: This API key is intended to be public and must be restricted
// in the Google Cloud Console using HTTP referrer restrictions to prevent unauthorized use.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
const GOOGLE_CX = import.meta.env.VITE_GOOGLE_SEARCH_ID;

/**
 * Normalizes the response from Google Custom Search API.
 */
function normalizeGoogleSearchResponse(apiResponse: any): EvidenceItem[] {
    if (!apiResponse?.items) {
        return [];
    }
    return apiResponse.items.map((item: any): EvidenceItem => ({
        id: uuidv4(),
        source_name: item.displayLink,
        source_url: item.link,
        published_at: item.pagemap?.metatags?.[0]?.['article:published_time'] || null,
        title: item.title,
        snippet: item.snippet,
        confidence_score: 0.65, // Google Search is broad, so default confidence is lower
        retrieved_at: new Date().toISOString(),
        metadata: {
            author: item.pagemap?.person?.[0]?.name || null,
            domain_authority: null,
            api_source: 'google',
        },
    }));
}

/**
 * Fetches search results directly from the Google Custom Search API.
 * @param query - The search query string.
 * @returns A promise that resolves to an array of normalized EvidenceItem objects.
 */
export async function fetchGoogleSearchEvidence(query: string): Promise<EvidenceItem[]> {
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
        console.error("Google API Key or CX is not configured in .env file.");
        return [];
    }
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google Search API error: ${errorData.error.message}`);
        }
        const data = await response.json();
        return normalizeGoogleSearchResponse(data);
    } catch (error) {
        console.error("Failed to fetch from Google Search Frontend Client:", error);
        return []; // Return empty array on failure
    }
}
