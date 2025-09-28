import { RobustHttpClient } from './httpClient';
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
}

export class SerpApiService {
  private static instance: SerpApiService;
  private httpClient = RobustHttpClient.getInstance();
  private cache = AdvancedCacheService.getInstance();
  private apiKey: string;

  static getInstance(): SerpApiService {
    if (!SerpApiService.instance) {
      SerpApiService.instance = new SerpApiService();
    }
    return SerpApiService.instance;
  }

  constructor() {
    this.apiKey = import.meta.env.VITE_SERP_API_KEY ||
                   localStorage.getItem('serp_api_key') || '';
  }

  async search(query: string, maxResults: number = 10): Promise<SerpApiResponse> {
    if (!this.apiKey) {
      throw new Error('SERP API key not configured');
    }

    const cacheKey = this.cache.generateKey('serp_api', await generateSHA256(query));

    // Check cache first
    const cached = await this.cache.get<SerpApiResponse>(cacheKey);
    if (cached) {
      console.log('✅ Using cached SERP API results');
      return cached;
    }

    try {
      const url = 'https://serpapi.com/search.json';
      const params = new URLSearchParams({
        api_key: this.apiKey,
        q: query,
        num: maxResults.toString(),
        engine: 'google',
        gl: 'us',
        hl: 'en'
      });

      const data = await this.httpClient.request<any>(`${url}?${params}`, {
        timeout: 20000,
        retryConfig: { maxRetries: 2 }
      });

      // Process results
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

      const response: SerpApiResponse = {
        results,
        aiOverview,
        totalResults: data.search_information?.total_results || 0
      };

      // Cache results
      await this.cache.set(cacheKey, response, 'serpApiTTL');

      console.log(`✅ SERP API returned ${results.length} results`);
      return response;

    } catch (error) {
      console.error('SERP API error:', error);

      if (error instanceof Error && error.message.includes('Authentication')) {
        throw new Error('Invalid SERP API key. Please check your settings.');
      }

      // Graceful fallback
      return {
        results: [],
        aiOverview: null,
        totalResults: 0
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