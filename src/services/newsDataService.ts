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

  static getInstance(): NewsDataService {
    if (!NewsDataService.instance) {
      NewsDataService.instance = new NewsDataService();
    }
    return NewsDataService.instance;
  }

  constructor() {
    // API key is now handled server-side.
  }

  async searchNews(query: string, options: {
    fromDate?: string;
    toDate?: string;
    maxResults?: number;
    language?: string;
    country?: string;
  } = {}): Promise<NewsDataResponse> {

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
      const url = '/api/newsdata-search';
      const body = {
        query,
        fromDate,
        toDate,
        maxResults,
        language,
        country,
      };

      const data = await this.httpClient.request<{
        status: string;
        totalResults: number;
        results: any[];
        nextPage?: string;
      }>(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 25000,
        retryConfig: { maxRetries: 2 },
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
}