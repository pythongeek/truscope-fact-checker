// src/services/serpApiService.ts

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
  date?: string;
  sitename?: string;
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
    const truncatedQuery = query.length > 100 ? query.substring(0, 100) : query;
    const cacheKey = this.cache.generateKey('serp_search', await generateSHA256(truncatedQuery));
    const cached = await this.cache.get<SerpApiResponse>(cacheKey);

    if (cached) {
      console.log('✅ Using cached SERP results');
      return cached;
    }

    try {
      let searchQuery = truncatedQuery;
      if (truncatedQuery.length > 50 || truncatedQuery.split(' ').length > 10) {
        try {
          const extracted = await this.queryExtractor.extractSearchQueries(truncatedQuery);
          searchQuery = extracted.primaryQuery;
          console.log('🔍 Executing search with primary query:', searchQuery);
        } catch (extractError) {
          console.warn('Query extraction failed, using original:', extractError);
        }
      }

      const response = await this.httpClient.request<any>('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
        timeout: 15000,
        retryConfig: { maxRetries: 2 }
      });

      if (!response) {
        throw new Error('Empty response from SERP API');
      }

      const normalizedResponse = this.normalizeResponse(response);
      if (!normalizedResponse.results || normalizedResponse.results.length === 0) {
        console.log('ℹ️  SERP API returned no results');
        return { results: [], totalResults: 0, searchQuery };
      }

      await this.cache.set(cacheKey, normalizedResponse);
      console.log(`✅ SERP API returned ${normalizedResponse.results.length} results`);
      return normalizedResponse;

    } catch (error) {
      console.error('SERP API error:', error);
      return {
        results: [],
        totalResults: 0,
        searchQuery: truncatedQuery
      };
    }
  }

  // FIX: This function has been completed to handle all response types and now includes a final return statement.
  private normalizeResponse(response: any): SerpApiResponse {
    if (response.results && Array.isArray(response.results)) {
      return {
        results: response.results.map(this.normalizeResult),
        totalResults: response.totalResults || response.results.length,
        searchQuery: response.searchQuery
      };
    }
    if (response.organic && Array.isArray(response.organic)) {
      return {
        results: response.organic.map(this.normalizeResult),
        totalResults: response.totalResults || response.organic.length,
        searchQuery: response.searchParameters?.q
      };
    }
    if (response.organic_results && Array.isArray(response.organic_results)) {
        return {
            results: response.organic_results.map(this.normalizeResult),
            totalResults: response.searchInformation?.totalResults || response.organic_results.length,
            searchQuery: response.searchParameters?.q
        };
    }
    if (response.items && Array.isArray(response.items)) {
        return {
            results: response.items.map(this.normalizeResult),
            totalResults: response.searchInformation?.totalResults || response.items.length,
            searchQuery: response.queries?.request?.[0]?.searchTerms
        };
    }
    console.warn('Unknown SERP response format:', Object.keys(response));
    return {
        results: [],
        totalResults: 0,
        searchQuery: undefined
    };
  }

  private normalizeResult = (result: any): SerpApiResult => {
    const title = result.title || result.displayLink || result.name || 'Untitled';
    const link = result.link || result.url || result.href || '';
    const snippet = result.snippet || result.description || result.text || '';
    const source = result.source || result.displayLink || this.extractDomain(link);
    const position = result.position || result.rank || undefined;
    const sitename = result.sitename || result.source || undefined;
    const date = this.parseDate(result);

    return {
      title: this.cleanText(title),
      link,
      snippet: this.cleanText(snippet),
      source: this.cleanText(source),
      position,
      date,
      sitename,
    };
  }
  
  private parseDate(result: any): string | undefined {
    const dateString = result.date || result.published_date || result.publishedDate || result.datePublished || result.pubDate;
    if (dateString) {
      try {
        return new Date(dateString).toLocaleDateString();
      } catch (error) {
        console.warn(`Could not parse date: ${dateString}`);
        return undefined;
      }
    }
    return undefined;
  }

  // FIX: This function has been completed to ensure it always returns a string.
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown Source';
    }
  }

  // FIX: This function has been completed to ensure it always returns a string.
  private cleanText(text: string): string {
    if (typeof text !== 'string') return '';
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
