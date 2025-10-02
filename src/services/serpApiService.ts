import { queryExtractor, ExtractedQueries } from './queryExtractor';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';

export interface SerpApiResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  position: number;
}

export interface SerpApiResponse {
  results: SerpApiResult[];
  aiOverview: string | null;
  totalResults: number;
  queries: ExtractedQueries;
  error?: string;
}

export class SerpApiService {
  private static instance: SerpApiService;
  private cache = AdvancedCacheService.getInstance();
  private queryExtractor = queryExtractor;

  static getInstance(): SerpApiService {
    if (!SerpApiService.instance) {
      SerpApiService.instance = new SerpApiService();
    }
    return SerpApiService.instance;
  }

  constructor() {
    // API key is now handled server-side.
  }

  async search(text: string, maxResults: number = 10): Promise<SerpApiResponse> {
    try {
      // Extract optimized search queries from the input text
      const queries = await this.queryExtractor.extractSearchQueries(text);

      console.log('🔍 Executing search with primary query:', queries.primaryQuery);

      const cacheKey = this.cache.generateKey('serp', await generateSHA256(queries.primaryQuery));
      const cached = await this.cache.get<SerpApiResponse>(cacheKey);

      if (cached) {
        console.log('✅ Using cached SERP results');
        return cached;
      }

      // Call the server-side API endpoint
      const response = await fetch('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queries.primaryQuery,
          num: maxResults
        })
      });

      if (!response.ok) {
        throw new Error(`SERP API error: ${response.status}`);
      }

      const data = await response.json();

      // Process the raw API response
      const results: SerpApiResult[] = (data.organic_results || []).map((result: any, index: number) => ({
        title: result.title || 'No title',
        link: result.link || '#',
        snippet: result.snippet || result.description || 'No description available',
        source: this.extractDomain(result.link),
        position: index + 1
      }));

      // Extract AI Overview if available
      let aiOverview: string | null = null;
      if (data.ai_overview && data.ai_overview.text_blocks) {
        aiOverview = data.ai_overview.text_blocks
          .map((block: any) => block.snippet || '')
          .join('\n');
      }

      // Construct the final, typed response object
      const processedResponse: SerpApiResponse = {
        results,
        aiOverview,
        totalResults: data.search_information?.total_results || 0,
        queries,
      };

      // Cache the processed results with the correct TTL key
      await this.cache.set(cacheKey, processedResponse, 'serpApiTTL');

      console.log(`✅ SERP API returned ${results.length} results`);
      return processedResponse;

    } catch (error) {
      console.error('SERP search failed:', error);
      // Return a response object that conforms to the SerpApiResponse interface
      return {
        results: [],
        aiOverview: null,
        totalResults: 0,
        error: error instanceof Error ? error.message : 'Search failed',
        queries: {
          primaryQuery: text,
          subQueries: [],
          keywords: [],
          entities: [],
          searchPriority: 'medium'
        }
      };
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }
}