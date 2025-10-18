import { AdvancedEvidence, MultiSourceResult } from '@/types/enhancedFactCheck';
import { getSourceReliability } from '../data/sourceReliability';
import { calculateRecency } from '../utils/time';
import { NewsService } from './newsService'; // Import the new NewsService

export class MultiSourceVerifier {
  // --- Service Dependencies ---
  private newsService: NewsService; // Add an instance of our new service

  // --- Free API Endpoints ---
  private readonly FREE_APIS = {
    wikipedia: 'https://en.wikipedia.org/api/rest_v1/',
    pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    arxiv: 'https://export.arxiv.org/api/',
    googleNews: 'https://news.google.com/rss/search?q=',
    governmentData: 'https://api.data.gov/',
  };

  constructor() {
    this.newsService = new NewsService(); // Initialize the NewsService
  }

  /**
   * Orchestrates the verification process by querying multiple trusted sources in parallel.
   * This now includes our custom News API integration.
   */
  async verifyWithMultipleSources(query: string): Promise<MultiSourceResult[]> {
    // --- Promise-based parallel fetching for better performance ---
    const promises = [
      this.searchNewsApi(query), // Query the new News API
      this.searchWikipedia(query),
      this.searchPubMed(query),
      this.searchArXiv(query),
      this.searchGoogleNews(query),
      this.scrapeFactCheckSites(query),
    ];

    const results = await Promise.all(promises);

    // Filter out sources that returned no results or had errors.
    return results.filter(result => result.available);
  }

  /**
   * Searches for news articles using our dedicated NewsService.
   * This method adapts the response from NewsData.io to our internal data structure.
   */
  private async searchNewsApi(query: string): Promise<MultiSourceResult> {
    try {
      const response = await this.newsService.searchNews({ query });
      const results: AdvancedEvidence[] = (response.results || []).map((item: any) => ({
        id: `news_${item.article_id}`,
        title: item.title,
        snippet: item.description || '',
        url: item.link || null,
        publishedDate: item.pubDate,
        source: {
          name: item.source_id || 'NewsData.io',
          url: item.link || '',
          credibility: {
            rating: 'Medium', // Default rating, could be enhanced later
            classification: 'News',
            warnings: [],
          },
        },
        publisher: item.source_id || 'NewsData.io',
        recency: calculateRecency(item.pubDate),
        // --- Default scores for now, can be refined ---
        score: 75,
        credibilityScore: 75,
        relevanceScore: 80,
        supportsClaim: true, // Default assumption
        // --- Fields to satisfy the AdvancedEvidence type ---
        type: 'news',
        sourceCredibility: 75,
        authorCredibility: 65,
        contradictsClaim: false,
        factCheckVerdict: 'unknown',
        biasScore: 0,
        lastVerified: new Date().toISOString(),
      }));

      return {
        source: 'news-api',
        available: results.length > 0,
        results,
        searchQuery: query,
      };
    } catch (error) {
      console.error('[MultiSourceVerifier] News API search failed:', error);
      return {
        source: 'news-api',
        available: false,
        results: [],
        error: (error as Error).message,
        searchQuery: query,
      };
    }
  }

  // No changes needed for the methods below, they are included for completeness.

  private _parseXml(xml: string, tag: string): string[] {
    const results: string[] = [];
    const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gs");
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const content = match[1].replace('<![CDATA[', '').replace(']]>', '');
      results.push(content.trim());
    }
    return results;
  }

  private async searchWikipedia(query: string): Promise<MultiSourceResult> {
    const url = `${this.FREE_APIS.wikipedia}page/summary/${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { source: 'wikipedia', available: false, results: [], searchQuery: query };
      }

      const data = await response.json();
      const evidence: AdvancedEvidence = {
        id: `wiki_${Date.now()}`,
        title: data.title || query,
        snippet: data.extract || '',
        source: {
          name: 'Wikipedia',
          url: data.content_urls?.desktop?.page || '',
          credibility: {
            rating: 'Medium',
            classification: 'User-generated',
            warnings: ['Wikipedia is user-generated and not considered a primary source.'],
          },
        },
        publisher: 'Wikipedia',
        url: data.content_urls?.desktop?.page || null,
        quote: data.extract || '',
        score: 75,
        credibilityScore: 75,
        type: 'claim',
        sourceCredibility: 75,
        authorCredibility: 65,
        recency: 30,
        relevanceScore: 80,
        contradictsClaim: false,
        supportsClaim: true,
        factCheckVerdict: 'unknown',
        biasScore: 0,
        lastVerified: new Date().toISOString(),
      };

      return {
        source: 'wikipedia',
        available: true,
        results: [evidence],
        searchQuery: query
      };
    } catch (error) {
      return { source: 'wikipedia', available: false, results: [], error: (error as Error).message, searchQuery: query };
    }
  }

  private async searchPubMed(query: string): Promise<MultiSourceResult> {
    const searchUrl = `${this.FREE_APIS.pubmed}esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=3`;
    try {
      const response = await fetch(searchUrl);
      if (!response.ok) {
        return { source: 'pubmed', available: false, results: [], searchQuery: query };
      }

      const data = await response.json();
      const results: AdvancedEvidence[] = [];

      if (data.esearchresult?.idlist) {
        for (const id of data.esearchresult.idlist.slice(0, 3)) {
          const detailUrl = `${this.FREE_APIS.pubmed}esummary.fcgi?db=pubmed&id=${id}&retmode=json`;
          const detailResponse = await fetch(detailUrl);
          const detailData = await detailResponse.json();

          const paper = detailData.result[id];
          if (paper) {
            results.push({
              id: `pubmed_${id}`,
              title: paper.title,
              snippet: paper.title,
              source: {
                name: 'PubMed',
                url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                credibility: {
                  rating: 'High',
                  classification: 'Medical Journal',
                  warnings: [],
                },
              },
              publisher: 'PubMed',
              url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
              quote: paper.title,
              score: 92,
              credibilityScore: 92,
              type: 'claim',
              sourceCredibility: 92,
              authorCredibility: 90,
              recency: calculateRecency(paper.pubdate),
              relevanceScore: 85,
              contradictsClaim: false,
              supportsClaim: true,
              factCheckVerdict: 'unknown',
              biasScore: 0,
              publishedDate: paper.pubdate,
              lastVerified: new Date().toISOString(),
            });
          }
        }
      }

      return {
        source: 'pubmed',
        available: true,
        results,
        searchQuery: query
      };
    } catch (error) {
      return { source: 'pubmed', available: false, results: [], error: (error as Error).message, searchQuery: query };
    }
  }

  private async scrapeFactCheckSites(query: string): Promise<MultiSourceResult> {
    // This method would need a real implementation, perhaps using SerpApiService
    return { source: 'factcheck', available: false, results: [], searchQuery: query };
  }

  private async searchArXiv(query: string): Promise<MultiSourceResult> {
    const url = `${this.FREE_APIS.arxiv}query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { source: 'arxiv', available: false, results: [], searchQuery: query };
      }

      const xmlText = await response.text();
      const entries = xmlText.split('</entry>');
      const results: AdvancedEvidence[] = [];

      for (const entry of entries) {
        if (!entry.includes('<entry>')) continue;

        const id = this._parseXml(entry, 'id')[0] || '';
        const title = this._parseXml(entry, 'title')[0] || '';
        const summary = this._parseXml(entry, 'summary')[0] || '';
        const published = this._parseXml(entry, 'published')[0] || '';

        if (id && title) {
          results.push({
            id: `arxiv_${id}`,
            title: title,
            snippet: summary.replace(/\n/g, ' '),
            source: {
              name: 'arXiv',
              url: id,
              credibility: {
                rating: 'High',
                classification: 'Academic Preprint',
                warnings: ['Preprint articles are not peer-reviewed.'],
              },
            },
            publisher: 'arXiv',
            url: id,
            quote: `${title}. ${summary.replace(/\n/g, ' ')}`,
            score: 85,
            credibilityScore: 85,
            type: 'claim',
            sourceCredibility: 85,
            authorCredibility: 80,
            recency: calculateRecency(published),
            relevanceScore: 80,
            contradictsClaim: false,
            supportsClaim: true,
            factCheckVerdict: 'unknown',
            biasScore: 0,
            publishedDate: published,
            lastVerified: new Date().toISOString(),
          });
        }
      }

      return {
        source: 'arxiv',
        available: results.length > 0,
        results,
        searchQuery: query
      };
    } catch (error) {
      return { source: 'arxiv', available: false, results: [], error: (error as Error).message, searchQuery: query };
    }
  }

  private async searchGoogleNews(query: string): Promise<MultiSourceResult> {
    const url = `${this.FREE_APIS.googleNews}${encodeURIComponent(query)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { source: 'googleNews', available: false, results: [], searchQuery: query };
      }

      const xmlText = await response.text();
      const items = xmlText.split('</item>');
      const results: AdvancedEvidence[] = [];

      for (const item of items) {
        if (!item.includes('<item>')) continue;

        const title = this._parseXml(item, 'title')[0] || '';
        const link = this._parseXml(item, 'link')[0] || '';
        const pubDate = this._parseXml(item, 'pubDate')[0] || '';
        const description = this._parseXml(item, 'description')[0] || '';

        if (title && link) {
          const sourceName = this._parseXml(item, 'source')[0] || 'Google News';

          results.push({
            id: `gnews_${Date.now()}`,
          	title: title,
          	snippet: description.replace(/<[^>]*>?/gm, ''),
          	source: {
            	name: sourceName,
            	url: link,
            	credibility: {
              	rating: 'Medium',
              	classification: 'News',
              	warnings: [],
            	},
          	},
          	publisher: sourceName,
          	url: link,
          	quote: `${title}. ${description.replace(/<[^>]*>?/gm, '')}`,
          	score: 70,
          	credibilityScore: 70,
          	type: 'news',
          	sourceCredibility: 70,
          	authorCredibility: 65,
          	recency: calculateRecency(pubDate),
          	relevanceScore: 75,
          	contradictsClaim: false,
        	  supportsClaim: true,
          	factCheckVerdict: 'unknown',
          	biasScore: 0,
          	publishedDate: pubDate,
          	lastVerified: new Date().toISOString(),
          });
        }
      }

      return {
        source: 'googleNews',
        available: results.length > 0,
        results: results.slice(0, 5),
        searchQuery: query
      };
    } catch (error) {
      return { source: 'googleNews', available: false, results: [], error: (error as Error).message, searchQuery: query };
    }
  }
}
