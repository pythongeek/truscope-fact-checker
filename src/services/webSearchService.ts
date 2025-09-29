import { SerpApiService, SerpApiResponse } from './serpApiService';
import { GoogleFactCheckService, GoogleFactCheckResult } from './googleFactCheckService';
import { NewsDataService, NewsDataResponse } from './newsDataService';

export interface WebSearchResult {
  serp: SerpApiResponse;
  factCheck: GoogleFactCheckResult[];
  news: NewsDataResponse;
}

export class WebSearchService {
  private static instance: WebSearchService;
  private serpApiService = SerpApiService.getInstance();
  private googleFactCheckService = GoogleFactCheckService.getInstance();
  private newsDataService = NewsDataService.getInstance();

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
      maxNewsResults = 10
    } = options;

    console.log('⚡️ Kicking off parallel web searches...');

    try {
      const [serpResponse, factCheckResponse, newsResponse] = await Promise.all([
        this.serpApiService.search(query, maxSerpResults),
        this.googleFactCheckService.searchClaims(query, maxFactCheckResults),
        this.newsDataService.searchNews(query, { maxResults: maxNewsResults })
      ]);

      console.log('✅ All parallel searches completed successfully.');

      return {
        serp: serpResponse,
        factCheck: factCheckResponse,
        news: newsResponse
      };
    } catch (error) {
      console.error('An error occurred during parallel web searches:', error);
      throw new Error('Failed to complete web search orchestration.');
    }
  }

  async temporalSearch(query: string, date: string, windowDays: number = 3): Promise<NewsDataResponse> {
    console.log(`⚡️ Performing temporal news search for query: "${query}" around date: ${date}`);
    return this.newsDataService.searchTemporalNews(query, date, windowDays);
  }
}