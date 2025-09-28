import { RobustHttpClient } from './httpClient';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';

export interface GoogleFactCheckResult {
  text: string;
  claimant: string;
  claimDate: string;
  claimReview: Array<{
    publisher: string;
    url: string;
    title: string;
    reviewRating: {
      ratingValue: number;
      textualRating: string;
      worstRating: number;
      bestRating: number;
    };
  }>;
  languageCode: string;
}

export class GoogleFactCheckService {
  private static instance: GoogleFactCheckService;
  private httpClient = RobustHttpClient.getInstance();
  private cache = AdvancedCacheService.getInstance();
  private apiKey: string;

  static getInstance(): GoogleFactCheckService {
    if (!GoogleFactCheckService.instance) {
      GoogleFactCheckService.instance = new GoogleFactCheckService();
    }
    return GoogleFactCheckService.instance;
  }

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_FACT_CHECK_API_KEY ||
                   localStorage.getItem('fact_check_api_key') || '';
  }

  async searchClaims(claimText: string, maxResults: number = 5): Promise<GoogleFactCheckResult[]> {
    if (!this.apiKey) {
      throw new Error('Google Fact Check API key not configured');
    }

    const cacheKey = this.cache.generateKey('google_fact_check', await generateSHA256(claimText));

    // Check cache first
    const cached = await this.cache.get<GoogleFactCheckResult[]>(cacheKey);
    if (cached) {
      console.log('✅ Using cached Google Fact Check results');
      return cached;
    }

    try {
      const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search`;
      const params = new URLSearchParams({
        key: this.apiKey,
        query: claimText,
        pageSize: maxResults.toString(),
        offset: '0'
      });

      const data = await this.httpClient.request<{ claims?: GoogleFactCheckResult[] }>(
        `${url}?${params}`,
        {
          timeout: 15000,
          retryConfig: { maxRetries: 2 }
        }
      );

      const results = data.claims || [];

      // Filter for high-similarity matches
      const filteredResults = this.filterBySimilarity(claimText, results);

      // Cache results
      await this.cache.set(cacheKey, filteredResults, 'factCheckTTL');

      console.log(`✅ Google Fact Check API returned ${filteredResults.length} relevant results`);
      return filteredResults;

    } catch (error) {
      console.error('Google Fact Check API error:', error);

      if (error instanceof Error && error.message.includes('Authentication')) {
        throw new Error('Invalid Google Fact Check API key. Please check your settings.');
      }

      // Return empty array for graceful degradation
      return [];
    }
  }

  private filterBySimilarity(originalClaim: string, results: GoogleFactCheckResult[]): GoogleFactCheckResult[] {
    // Simple similarity check based on common keywords
    const originalWords = new Set(
      originalClaim.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
    );

    return results.filter(result => {
      const resultWords = new Set(
        result.text.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3)
      );

      const intersection = new Set([...originalWords].filter(word => resultWords.has(word)));
      const similarityScore = intersection.size / Math.max(originalWords.size, 1);

      return similarityScore > 0.3; // 30% similarity threshold
    });
  }
}