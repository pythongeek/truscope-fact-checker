import { GoogleSearchResult } from '../types';
import { getSearchApiKey, getSearchId } from './apiKeyService';

// --- Source Credibility Assessment ---

const HIGH_CREDIBILITY_DOMAINS = [
    'apnews.com', 'reuters.com', 'bbc.com', 'nytimes.com', 'wsj.com', 
    'washingtonpost.com', 'theguardian.com', 'npr.org', 'pbs.org', 
    'factcheck.org', 'politifact.com', 'snopes.com', 'c-span.org',
    'nature.com', 'science.org', 'thelancet.com', 'nejm.org'
];

const LOW_CREDIBILITY_DOMAINS = [
    // Example list, would be populated with known disinformation sources
    'infowars.com', 'breitbart.com', 'dailycaller.com' 
];

/**
 * Scores a given URL based on its domain.
 * @param url The URL to assess.
 * @returns A credibility score from 0 to 100.
 */
export const assessSourceCredibility = (url: string): number => {
    try {
        const domain = new URL(url).hostname.replace(/^www\./, '');

        if (HIGH_CREDIBILITY_DOMAINS.includes(domain)) {
            return 95;
        }
        if (LOW_CREDIBILITY_DOMAINS.includes(domain)) {
            return 15;
        }
        if (domain.endsWith('.gov') || domain.endsWith('.edu')) {
            return 85;
        }
        // Could add more rules for medium credibility, news domains, etc.
        return 50; // Neutral default score
    } catch (error) {
        console.warn(`Could not assess credibility for invalid URL: ${url}`);
        return 30; // Low score for invalid URLs
    }
};


// --- Web Search Implementation ---

const MOCK_SEARCH_DATA: GoogleSearchResult[] = [
    {
        title: "Mock Dev Result: FactCheck.org",
        link: "https://www.factcheck.org/mock-entry/",
        snippet: "This is a mock result for development. The web search API failed or was not called.",
        source: "factcheck.org"
    },
    {
        title: "Mock Dev Result: Reputable News Source",
        link: "https://www.reuters.com/mock-article/",
        snippet: "This mock snippet simulates a result from a high-credibility news outlet for testing purposes.",
        source: "reuters.com"
    },
];

/**
 * Performs a web search using the Google Custom Search API.
 * @param query The search query string.
 * @param maxResults The maximum number of results to return.
 * @returns A promise that resolves to an array of search results.
 */
export async function search(query: string, maxResults: number): Promise<GoogleSearchResult[]> {
    try {
        const apiKey = getSearchApiKey();
        const searchId = getSearchId();
        const endpoint = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchId}&q=${encodeURIComponent(query)}&num=${maxResults}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google Search API error (${response.status}): ${errorData.error.message}`);
        }
        const data = await response.json();
        
        if (!data.items) {
            return [];
        }

        return data.items.map((item: any): GoogleSearchResult => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: item.displayLink,
        }));

    } catch (error) {
        console.error("Web search API call failed. Returning mock data.", error);
        // Fallback to mock data for development as required.
        return MOCK_SEARCH_DATA;
    }
}

/**
 * Generates and runs multiple, targeted searches based on a claim to ensure diverse results.
 * This version uses more sophisticated query generation and a robust deduplication mechanism.
 * @param claim The claim text to investigate.
 * @param keywords A list of keywords related to the claim.
 * @returns A promise that resolves to a deduplicated array of search results.
 */
export async function executeMultiStrategySearch(claim: string, keywords: string[]): Promise<GoogleSearchResult[]> {
    const searchQueries = new Set<string>();

    // Strategy 1: Exact phrase match for the core claim
    searchQueries.add(`"${claim}"`);

    // Strategy 2: Keywords + fact-checking terms
    if (keywords.length > 0) {
        searchQueries.add(`${keywords.join(' ')} fact check`);
    }

    // Strategy 3: Search for opposing views and counter-arguments
    searchQueries.add(`"${claim}" opposing views`);

    // Strategy 4: Investigate potential controversy around the main entities
    if (keywords.length > 0) {
        const primaryKeyword = keywords[0];
        searchQueries.add(`"${primaryKeyword}" controversy`);
    }

    // Strategy 5: Targeted search on a curated list of high-credibility fact-checking sites
    const factCheckSites = ['factcheck.org', 'politifact.com', 'snopes.com', 'reuters.com/fact-check', 'apnews.com/hub/ap-fact-check'];
    const siteQuery = factCheckSites.map(site => `site:${site}`).join(' OR ');
    if (keywords.length > 0) {
        searchQueries.add(`(${keywords.join(' OR ')}) ${siteQuery}`);
    }

    // Strategy 6: General query for context
    searchQueries.add(claim);

    const queriesToRun = Array.from(searchQueries);
    // Fetch a small number of results per query to get a broad sample
    const searchPromises = queriesToRun.map(query => search(query, 3));

    try {
        const resultsByStrategy = await Promise.all(searchPromises);
        const allResults = resultsByStrategy.flat();

        // Deduplicate results based on the link to avoid redundancy
        const uniqueResults = new Map<string, GoogleSearchResult>();
        for (const result of allResults) {
            if (result && result.link && !uniqueResults.has(result.link)) {
                uniqueResults.set(result.link, result);
            }
        }
        
        return Array.from(uniqueResults.values());
    } catch (error) {
        console.error("Multi-strategy search failed.", error);
        return MOCK_SEARCH_DATA; // Fallback in case Promise.all fails
    }
}