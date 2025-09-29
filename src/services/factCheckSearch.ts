import { getSerpApiKey, getSearchApiKey, getSearchId } from './apiKeyService';
import { generateSHA256 } from '../utils/hashUtils';
import { getCache, setCache } from './caching';
import { search as googleSearch } from './webSearch'; // This is the Google Custom Search function

/**
 * Helper function to call the SERP API directly.
 */
async function callSerpApi(query: string, apiKey: string, numResults: number) {
    if (!apiKey) {
        console.warn("SERP API key is missing. Skipping SERP API call.");
        return null;
    }
    const endpoint = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${numResults}&engine=google&gl=us&hl=en`;
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            console.error(`SERP API request failed with status: ${response.status}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error("Error calling SERP API:", error);
        return null;
    }
}

/**
 * Helper function to call the Google Custom Search API via the existing webSearch service.
 */
async function callGoogleCustomSearch(text: string, apiKey: string, cx: string, numResults: number) {
    if (!apiKey || !cx) {
        console.warn("Google Custom Search API key or CX is missing. Skipping Google Custom Search call.");
        return null;
    }
    // The `googleSearch` function from `webSearch.ts` handles its own API key retrieval,
    // but we confirm they exist before calling.
    return await googleSearch(text, numResults);
}

/**
 * Phase 2: Orchestrates the Enhanced Web Search with caching and parallel API calls.
 * @param text The claim to search for.
 * @returns Combined search results, including SERP AI Overview.
 */
export async function runPhase2WebSearch(text: string): Promise<{ serpResults: any[]; googleGroundingResults: any[]; aiOverview: string }> {
    const claimHash = await generateSHA256(text);
    const cacheKey = `websearch_${claimHash}`;

    // 1. Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
        console.log(`Cache hit for ${cacheKey}`);
        return cached;
    }

    // Prepare front-facing API keys
    const serpKey = getSerpApiKey();
    const googleKey = getSearchApiKey();
    const googleCx = getSearchId();

    const query = `fact check "${text}"`;

    // 2. Parallel API calls
    const serpCall = callSerpApi(query, serpKey!, 10);
    const googleCall = callGoogleCustomSearch(text, googleKey!, googleCx!, 10);

    const [serpResponse, googleResponse] = await Promise.all([serpCall, googleCall]);

    // Extract AI Overview and results from the correct paths
    const aiOverview = serpResponse?.ai_overview?.snippet || '';
    const serpOrganicResults = serpResponse?.organic_results || [];
    const googleOrganicResults = googleResponse || []; // googleSearch returns the array directly

    const result = {
        serpResults: serpOrganicResults,
        googleGroundingResults: googleOrganicResults,
        aiOverview: aiOverview,
    };

    // Cache the result for 1 hour
    await setCache(cacheKey, result, 3600);
    return result;
}