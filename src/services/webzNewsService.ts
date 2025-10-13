import { RobustHttpClient } from './httpClient';
import { NewsSource, SearchParams } from '@/types/factCheck';

export class WebzNewsService implements NewsSource {
  readonly name: string = 'Webz.io News';
  readonly url: string = 'https://webz.io/';
  readonly reliability: number = 80; // Added the missing 'reliability' property
  private httpClient: RobustHttpClient;

  constructor() {
    this.httpClient = RobustHttpClient.getInstance();
  }

  async searchNews(params: SearchParams): Promise<any> {
    const { query, fromDate } = params;

    const MAX_QUERY_LENGTH = 80; // Leave buffer under 100

    // Truncate and clean the query
    let cleanQuery = query
      .trim()
      .substring(0, MAX_QUERY_LENGTH);

    // Ensure it doesn't cut off mid-word
    const lastSpace = cleanQuery.lastIndexOf(' ');
    if (lastSpace > 50) { // Keep at least 50 chars
      cleanQuery = cleanQuery.substring(0, lastSpace);
    }

    console.log(`[WebzNewsService] Searching with truncated query (${cleanQuery.length} chars): "${cleanQuery}" from date: ${fromDate}`);

    const body = {
      query: cleanQuery,
      fromDate,
    };

    try {
      const data = await this.httpClient.request('/api/webz-news-search', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('[WebzNewsService] Received data:', data);
      // You may need to adapt the response structure to match what the rest of your app expects.
      // For now, we return the raw response.
      return data;
    } catch (error) {
      console.error('Webz.io API error:', error);
      throw error;
    }
  }
}
