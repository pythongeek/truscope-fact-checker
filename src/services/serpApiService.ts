// src/services/serpApiService.ts - FIXED VERSION

import { RobustHttpClient } from './httpClient';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';
import { QueryExtractorService } from './queryExtractor';

export interface SerpApiResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  position?: number;
}

export interface SerpApiResponse {
  results: SerpApiResult[];
  totalResults?: number;
  searchQuery?: string;
}

export class SerpApiService {
  private static instance: SerpApiService;
  private httpClient = RobustHttpClient.getInstance();
  private cache = AdvancedCacheService.getInstance();
  private queryExtractor = QueryExtractorService.getInstance();

  static getInstance(): SerpApiService {
    if (!SerpApiService.instance) {
      SerpApiService.instance = new SerpApiService();
    }
    return SerpApiService.instance;
  }

  async search(query: string, maxResults: number = 10): Promise<SerpApiResponse> {
    // CRITICAL FIX: Ensure query is reasonable length BEFORE any processing
    const truncatedQuery = query.length > 100 ? query.substring(0, 100) : query;

    const cacheKey = this.cache.generateKey('serp_search', await generateSHA256(truncatedQuery));

    // Check cache first
    const cached = await this.cache.get<SerpApiResponse>(cacheKey);
    if (cached) {
      console.log('✅ Using cached SERP results');
      return cached;
    }

    try {
      // Extract better search query if needed
      let searchQuery = truncatedQuery;

      // Only attempt extraction if query looks like it needs it (very long or unstructured)
      if (truncatedQuery.length > 50 || truncatedQuery.split(' ').length > 10) {
        try {
          const extracted = await this.queryExtractor.extractSearchQueries(truncatedQuery);
          searchQuery = extracted.primaryQuery;
          console.log('🔍 Executing search with primary query:', searchQuery);
        } catch (extractError) {
          console.warn('Query extraction failed, using original:', extractError);
          // Continue with original truncated query
        }
      }

      // Call server-side SERP API endpoint
      const response = await this.httpClient.request<any>('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
        timeout: 15000,
        retryConfig: { maxRetries: 2 }
      });

      // CRITICAL FIX: Validate and normalize response structure
      if (!response) {
        throw new Error('Empty response from SERP API');
      }

      // Handle different possible response structures
      const normalizedResponse = this.normalizeResponse(response);

      if (!normalizedResponse.results || normalizedResponse.results.length === 0) {
        console.log('ℹ️  SERP API returned no results');
        return { results: [], totalResults: 0, searchQuery };
      }

      // Cache the normalized response
      await this.cache.set(cacheKey, normalizedResponse, 'searchTTL');

      console.log(`✅ SERP API returned ${normalizedResponse.results.length} results`);
      return normalizedResponse;

    } catch (error) {
      console.error('SERP API error:', error);

      // Return empty results instead of throwing
      return {
        results: [],
        totalResults: 0,
        searchQuery: truncatedQuery
      };
    }
  }

  /**
   * CRITICAL FIX: Normalize different possible SERP API response formats
   */
  private normalizeResponse(response: any): SerpApiResponse {
    // Case 1: Response already has 'results' array
    if (response.results && Array.isArray(response.results)) {
      return {
        results: response.results.map(this.normalizeResult),
        totalResults: response.totalResults || response.results.length,
        searchQuery: response.searchQuery
      };
    }

    // Case 2: Response has 'organic' results (common SERP format)
    if (response.organic && Array.isArray(response.organic)) {
      return {
        results: response.organic.map(this.normalizeResult),
        totalResults: response.totalResults || response.organic.length,
        searchQuery: response.searchParameters?.q
      };
    }

    // Case 3: Response has 'organicResults' (Serper.dev format)
    if (response.organic_results && Array.isArray(response.organic_results)) {
      return {
        results: response.organic_results.map(this.normalizeResult),
        totalResults: response.searchInformation?.totalResults || response.organic_results.length,
        searchQuery: response.searchParameters?.q
      };
    }

    // Case 4: Response has 'items' (Google Custom Search format)
    if (response.items && Array.isArray(response.items)) {
      return {
        results: response.items.map(this.normalizeResult),
        totalResults: response.searchInformation?.totalResults || response.items.length,
        searchQuery: response.queries?.request?.[0]?.searchTerms
      };
    }

    // Case 5: Response is directly an array
    if (Array.isArray(response)) {
      return {
        results: response.map(this.normalizeResult),
        totalResults: response.length,
        searchQuery: undefined
      };
    }

    console.warn('Unknown SERP response format:', Object.keys(response));

    // Return empty results as fallback
    return {
      results: [],
      totalResults: 0,
      searchQuery: undefined
    };
  }

  /**
   * Normalize individual search result to standard format
   */
  private normalizeResult(result: any): SerpApiResult {
    // Handle different field names across SERP APIs
    const title = result.title || result.displayLink || result.name || 'Untitled';
    const link = result.link || result.url || result.href || '';
    const snippet = result.snippet || result.description || result.text || '';
    const source = result.source || result.displayLink || this.extractDomain(link);
    const position = result.position || result.rank || undefined;

    return {
      title: this.cleanText(title),
      link,
      snippet: this.cleanText(snippet),
      source: this.cleanText(source),
      position
    };
  }

  /**
   * Extract domain from URL for source attribution
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  }

  /**
   * Clean text by removing extra whitespace and HTML entities
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
}