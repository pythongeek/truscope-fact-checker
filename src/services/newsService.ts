import { RobustHttpClient } from './httpClient';
import { NewsSource, SearchParams } from '@/types/factCheck';

/**
 * Implements the NewsSource interface to provide news search functionality
 * using our secure, server-side News API endpoint.
 */
export class NewsService implements NewsSource {
  // --- Metadata for the news source ---
  readonly name: string = 'NewsData.io';
  readonly url: string = 'https://newsdata.io/';
  readonly reliability: number = 85; // Assign a reliability score for this source.

  private httpClient: RobustHttpClient;

  constructor() {
    this.httpClient = RobustHttpClient.getInstance();
  }

  /**
   * Performs a news search by sending a request to our Vercel serverless function.
   * @param params - The search parameters, including the query and optional date.
   * @returns A promise that resolves to the JSON response from the news API.
   */
  async searchNews(params: SearchParams): Promise<any> {
    const { query, fromDate } = params;

    // The query is passed directly; no client-side truncation is needed
    // as the News API has a much higher character limit than Webz.io.
    console.log(`[NewsService] Searching for: "${query}" from date: ${fromDate}`);

    const body = {
      query,
      fromDate,
    };

    try {
      // --- API Call to our own backend ---
      // This securely calls our /api/news-search endpoint, which then calls
      // the external News API with the protected API key.
      const data = await this.httpClient.request('/api/news-search', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('[NewsService] Received data:', data);

      // The response structure should be directly usable, but this is
      // where you would adapt it if the frontend expects a different format.
      return data;
    } catch (error) {
      console.error('[NewsService] API error:', error);
      // Re-throw the error to be handled by the calling component (e.g., show a toast notification).
      throw error;
    }
  }
}
