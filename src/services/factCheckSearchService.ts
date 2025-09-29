import { getSerpApiKey, getSearchApiKey, getSearchId } from './apiKeyService';
import { generateSHA256 } from '../utils/hashUtils';
import { getCache, setCache } from './caching';
import { search as googleSearch } from './webSearch';

export class FactCheckSearchService {
    private static instance: FactCheckSearchService;

    static getInstance(): FactCheckSearchService {
        if (!FactCheckSearchService.instance) {
            FactCheckSearchService.instance = new FactCheckSearchService();
        }
        return FactCheckSearchService.instance;
    }

    /**
     * Helper to call the SERP API directly.
     */
    private async callSerpApi(query: string, apiKey: string, numResults: number): Promise<any> {
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
     * Helper to call the Google Custom Search API via the existing webSearch service.
     */
    private async callGoogleCustomSearch(text: string, numResults: number): Promise<any[] | null> {
        const apiKey = getSearchApiKey();
        const cx = getSearchId();
        if (!apiKey || !cx) {
            console.warn("Google Custom Search API key or CX is missing. Skipping Google Custom Search call.");
            return null;
        }
        return await googleSearch(text, numResults);
    }

    /**
     * Phase 2: Orchestrates the Enhanced Web Search with caching and parallel API calls.
     * @param text The claim to search for.
     * @returns Combined search results, including SERP AI Overview.
     */
    public async runPhase2WebSearch(text: string): Promise<{ serpResults: any[]; googleGroundingResults: any[]; aiOverview: string }> {
        const claimHash = await generateSHA256(text);
        const cacheKey = `websearch_${claimHash}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            console.log(`Cache hit for ${cacheKey}`);
            return cached;
        }

        const serpKey = getSerpApiKey();
        const query = `fact check "${text}"`;

        const serpCall = this.callSerpApi(query, serpKey!, 10);
        const googleCall = this.callGoogleCustomSearch(text, 10);

        const [serpResponse, googleResponse] = await Promise.all([serpCall, googleCall]);

        const aiOverview = serpResponse?.ai_overview?.snippet || '';
        const serpOrganicResults = serpResponse?.organic_results || [];
        const googleOrganicResults = googleResponse || [];

        const result = {
            serpResults: serpOrganicResults,
            googleGroundingResults: googleOrganicResults,
            aiOverview: aiOverview,
        };

        await setCache(cacheKey, result, 3600);
        return result;
    }
}