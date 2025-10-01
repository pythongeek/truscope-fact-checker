import { RobustHttpClient } from './httpClient';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';
import { SerpApiResult, SerpApiResponse } from './serpApiService';

// This interface is kept for compatibility with TieredFactCheckService
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

  static getInstance(): GoogleFactCheckService {
    if (!GoogleFactCheckService.instance) {
      GoogleFactCheckService.instance = new GoogleFactCheckService();
    }
    return GoogleFactCheckService.instance;
  }

  // API key is no longer needed on the client-side
  constructor() {}

  async searchClaims(claimText: string, maxResults: number = 5): Promise<GoogleFactCheckResult[]> {
    const specializedQuery = `${claimText} site:factcheck.org OR site:politifact.com OR site:snopes.com OR site:reuters.com/fact-check OR site:apnews.com/hub/fact-checking`;
    const cacheKey = this.cache.generateKey('google_fact_check_via_serp', await generateSHA256(claimText));

    // Check cache first
    const cached = await this.cache.get<GoogleFactCheckResult[]>(cacheKey);
    if (cached) {
      console.log('✅ Using cached results for fact-check search via SERP');
      return cached;
    }

    try {
      // Call the server-side SERP API endpoint
      const response = await this.httpClient.request<SerpApiResponse>('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: specializedQuery,
          num: maxResults
        }),
        timeout: 15000,
        retryConfig: { maxRetries: 2 }
      });

      if (!response || !response.results) {
        throw new Error('Invalid response from SERP API endpoint');
      }

      // Transform the SERP API response to the GoogleFactCheckResult format
      const transformedResults = this.transformSerpResults(response.results);

      await this.cache.set(cacheKey, transformedResults, 'factCheckTTL');

      console.log(`✅ Fact-check search via SERP returned ${transformedResults.length} relevant results`);
      return transformedResults;

    } catch (error) {
      console.error('Fact-check search via SERP API error:', error);
      // Return empty array for graceful degradation
      return [];
    }
  }

  private transformSerpResults(results: SerpApiResult[]): GoogleFactCheckResult[] {
    return results.map(result => ({
      text: result.title,
      claimant: result.source, // Use the source as the claimant
      claimDate: new Date().toISOString(), // SERP API doesn't provide a claim date
      claimReview: [
        {
          publisher: result.source,
          url: result.link,
          title: result.title,
          // SERP API does not provide ratings, so we provide a neutral, unrated default.
          // The scoring logic in TieredFactCheckService will handle credibility assessment.
          reviewRating: {
            ratingValue: 3,
            textualRating: 'Unrated',
            worstRating: 1,
            bestRating: 5,
          },
        },
      ],
      languageCode: 'en',
    }));
  }
}
