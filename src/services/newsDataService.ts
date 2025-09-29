import { getNewsDataApiKey } from './apiKeyService';

// NOTE: Implement this with a Vercel API endpoint for a secure proxy
const NEWS_API_PROXY_ENDPOINT = '/api/proxy-newsdata';

/**
 * Phase 3: Executes temporal analysis using the newsdata.io API.
 * @param query The claim/query for the news search.
 * @param fromDate Start date for the search (YYYY-MM-DD).
 * @param toDate End date for the search (YYYY-MM-DD).
 * @param pageSize Max articles to retrieve (Max 20 per request is typical).
 */
export async function runPhase3TemporalAnalysis(query: string, fromDate: string, toDate: string, pageSize: number = 20): Promise<any> {
    const apiKey = getNewsDataApiKey();

    if (!apiKey) throw new Error("NewsData.io API Key is missing.");

    try {
        // This simulates a call to a Vercel serverless function that handles the secure fetch.
        const response = await fetch(NEWS_API_PROXY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: apiKey,
                params: {
                    q: query,
                    from_date: fromDate,
                    to_date: toDate,
                    size: pageSize,
                    language: 'en'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Proxy failed: ${errorData.details || response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error in NewsData.io temporal analysis:', error);
        throw new Error('NewsData.io temporal analysis failed to retrieve data.');
    }
}