import { HttpClient } from './httpClient';
import { NewsSource, SearchParams } from '../types';

export class WebzNewsService implements NewsSource {
  private httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient();
  }

  async searchNews(params: SearchParams): Promise<any> {
    const { query, fromDate } = params;
    console.log(`[WebzNewsService] Searching for: "${query}" from date: ${fromDate}`);

    const body = {
      query,
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
