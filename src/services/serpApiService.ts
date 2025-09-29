import { QueryExtractorService } from './queryExtractor';
import { AdvancedCacheService } from './advancedCacheService';
import { generateSHA256 } from '../utils/hashUtils';

export class SerpApiService {
  private static instance: SerpApiService;
  private cache = AdvancedCacheService.getInstance();
  private queryExtractor = QueryExtractorService.getInstance();

  static getInstance(): SerpApiService {
    if (!SerpApiService.instance) {
      SerpApiService.instance = new SerpApiService();
    }
    return SerpApiService.instance;
  }

  async search(text: string, maxResults: number = 10): Promise<any> {
    try {
      // Extract optimized search queries
      const queries = await this.queryExtractor.extractSearchQueries(text);

      console.log('🔍 Executing search with query:', queries.primaryQuery);

      const cacheKey = this.cache.generateKey('serp', await generateSHA256(queries.primaryQuery));
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        console.log('✅ Using cached SERP results');
        return cached;
      }

      // Call server-side API
      const response = await fetch('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queries.primaryQuery,
          num: maxResults
        })
      });

      if (!response.ok) {
        throw new Error(`SERP API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract relevant results
      const processedResults = {
        organic_results: data.organic_results || [],
        answer_box: data.answer_box,
        knowledge_graph: data.knowledge_graph,
        related_questions: data.related_questions || [],
        queries: queries // Include extracted queries for reference
      };

      await this.cache.set(cacheKey, processedResults, 'searchTTL');

      console.log(`✅ SERP API returned ${processedResults.organic_results.length} results`);
      return processedResults;

    } catch (error) {
      console.error('SERP search failed:', error);
      return {
        organic_results: [],
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }
}