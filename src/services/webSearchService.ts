import { SerpApiService, SerpApiResponse } from './serpApiService';
import { GoogleFactCheckService, GoogleFactCheckResult } from './googleFactCheckService';

export interface WebSearchResult {
  serp: SerpApiResponse;
  factCheck: GoogleFactCheckResult[];
}

export class WebSearchService {
  private static instance: WebSearchService;
  private serpApiService = SerpApiService.getInstance();
  private googleFactCheckService = GoogleFactCheckService.getInstance();

  static getInstance(): WebSearchService {
    if (!WebSearchService.instance) {
      WebSearchService.instance = new WebSearchService();
    }
    return WebSearchService.instance;
  }

  async search(query: string, options: {
    maxSerpResults?: number;
    maxFactCheckResults?: number;
    maxNewsResults?: number;
  } = {}): Promise<WebSearchResult> {
    const {
      maxSerpResults = 10,
      maxFactCheckResults = 5,
    } = options;

    console.log('⚡️ Kicking off parallel web searches...');

    try {
      const [serpResponse, factCheckResponse] = await Promise.all([
        this.serpApiService.search(query, maxSerpResults),
        this.googleFactCheckService.searchClaims(query, maxFactCheckResults),
      ]);

      console.log('✅ All parallel searches completed successfully.');

      return {
        serp: serpResponse,
        factCheck: factCheckResponse,
      };
    } catch (error) {
      console.error('An error occurred during parallel web searches:', error);
      throw new Error('Failed to complete web search orchestration.');
    }
  }
}