// src/services/serpApiService.ts - FIXED VERSION WITH DATE PROPERTY

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
  // ADDED: sitename property for the name of the source site
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
        console.log('ℹ️  SERP API returned no results');
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

  private normalizeResponse(response: any): SerpApiResponse {
    // ... (no changes in this function)
  }

  private normalizeResult = (result: any): SerpApiResult => {
    const title = result.title || result.displayLink || result.name || 'Untitled';
    const link = result.link || result.url || result.href || '';
    const snippet = result.snippet || result.description || result.text || '';
    const source = result.source || result.displayLink || this.extractDomain(link);
    const position = result.position || result.rank || undefined;
    
    // ADDED: Extract sitename from the search result
    const sitename = result.sitename || result.source || undefined;

    // IMPROVED: More robust date parsing
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
  
  // ADDED: A helper function to parse dates from various formats
  private parseDate(result: any): string | undefined {
    const dateString = result.date ||
                       result.published_date ||
                       result.publishedDate ||
                       result.datePublished ||
                       result.pubDate;

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


  private extractDomain(url: string): string {
    // ... (no changes in this function)
  }

  private cleanText(text: string): string {
    // ... (no changes in this function)
  }
}
