import { RobustHttpClient } from './httpClient';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';

export interface NewsDataArticle {
  title: string;
  link: string;
  description: string;
  content: string | null;
  pubDate: string;
  source_id: string;
  source_name: string;
  country: string[];
  category: string[];
  language: string;
}

export interface NewsDataResponse {
  articles: NewsDataArticle[];
  totalResults: number;
  nextPage?: string;
}

export class NewsDataService {
  private static instance: NewsDataService;
  private httpClient = RobustHttpClient.getInstance();
  private cache = AdvancedCacheService.getInstance();
  private apiKey: string;

  static getInstance(): NewsDataService {
    if (!NewsDataService.instance) {
      NewsDataService.instance = new NewsDataService();
    }
    return NewsDataService.instance;
  }

  constructor() {
    this.apiKey = import.meta.env.VITE_NEWSDATA_API_KEY ||
                   localStorage.getItem('newsdata_api_key') || '';
  }

  async searchNews(query: string, options: {
    fromDate?: string;
    toDate?: string;
    maxResults?: number;
    language?: string;
    country?: string;
  } = {}): Promise<NewsDataResponse> {
    if (!this.apiKey) {
      throw new Error('NewsData.io API key not configured');
    }

    const {
      fromDate,
      toDate,
      maxResults = 20,
      language = 'en',
      country = 'us'
    } = options;

    const cacheKey = this.cache.generateKey(
      'newsdata',
      await generateSHA256(`${query}_${fromDate}_${toDate}_${maxResults}`)
    );

    // Check cache first
    const cached = await this.cache.get<NewsDataResponse>(cacheKey);
    if (cached) {
      console.log('✅ Using cached NewsData.io results');
      return cached;
    }

    try {
      const url = 'https://newsdata.io/api/1/news';
      const params = new URLSearchParams({
        apikey: this.apiKey,
        q: query,
        language,
        country,
        size: Math.min(maxResults, 50).toString() // API limit
      });

      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const data = await this.httpClient.request<{
        status: string;
        totalResults: number;
        results: any[];
        nextPage?: string;
      }>(`${url}?${params}`, {
        timeout: 25000,
        retryConfig: { maxRetries: 2 }
      });

      if (data.status !== 'success') {
        throw new Error('NewsData.io API returned unsuccessful status');
      }

      const articles: NewsDataArticle[] = (data.results || []).map(article => ({
        title: article.title || 'No title',
        link: article.link || '#',
        description: article.description || 'No description',
        content: article.content || null,
        pubDate: article.pubDate || new Date().toISOString(),
        source_id: article.source_id || 'unknown',
        source_name: article.source_name || 'Unknown Source',
        country: article.country || [],
        category: article.category || [],
        language: article.language || language
      }));

      const response: NewsDataResponse = {
        articles,
        totalResults: data.totalResults || 0,
        nextPage: data.nextPage
      };

      // Cache results
      await this.cache.set(cacheKey, response, 'temporalTTL');

      console.log(`✅ NewsData.io returned ${articles.length} articles`);
      return response;

    } catch (error) {
      console.error('NewsData.io API error:', error);

      if (error instanceof Error && error.message.includes('Authentication')) {
        throw new Error('Invalid NewsData.io API key. Please check your settings.');
      }

      return {
        articles: [],
        totalResults: 0
      };
    }
  }

  async searchTemporalNews(query: string, date: string, windowDays: number = 3): Promise<NewsDataResponse> {
    const targetDate = new Date(date);
    const fromDate = new Date(targetDate);
    const toDate = new Date(targetDate);

    fromDate.setDate(fromDate.getDate() - windowDays);
    toDate.setDate(toDate.getDate() + windowDays);

    return this.searchNews(query, {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
      maxResults: 20
    });
  }

  /**
   * Phase 3: Executes temporal analysis using the newsdata.io API via a secure proxy.
   * @param query The claim/query for the news search.
   * @param fromDate Start date for the search (YYYY-MM-DD).
   * @param toDate End date for the search (YYYY-MM-DD).
   * @param pageSize Max articles to retrieve (Max 20 per request is typical).
   */
  async runPhase3TemporalAnalysis(query: string, fromDate: string, toDate: string, pageSize: number = 20): Promise<any> {
      const NEWS_API_PROXY_ENDPOINT = '/api/proxy-newsdata';

      if (!this.apiKey) {
          throw new Error("NewsData.io API Key is missing.");
      }

      try {
          const response = await fetch(NEWS_API_PROXY_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  apiKey: this.apiKey,
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
}