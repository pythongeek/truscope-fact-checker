import { AdvancedEvidence, MultiSourceResult } from '@/types/enhancedFactCheck';
import { getSourceReliability } from '../data/sourceReliability';
import { calculateRecency } from '../utils/time';

export class MultiSourceVerifier {
  private readonly FREE_APIS = {
    wikipedia: 'https://en.wikipedia.org/api/rest_v1/',
    pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    arxiv: 'https://export.arxiv.org/api/',
    googleNews: 'https://news.google.com/rss/search?q=',
    governmentData: 'https://api.data.gov/',
  };

  async verifyWithMultipleSources(query: string): Promise<MultiSourceResult[]> {
    const results: MultiSourceResult[] = [];

    // Wikipedia verification
    results.push(await this.searchWikipedia(query));

    // PubMed for scientific claims
    results.push(await this.searchPubMed(query));

    // ArXiv for academic papers
    results.push(await this.searchArXiv(query));

    // Google News RSS
    results.push(await this.searchGoogleNews(query));

    // Web scraping for fact-checking sites
    results.push(await this.scrapeFactCheckSites(query));

    return results.filter(result => result.available);
  }

  private _parseXml(xml: string, tag: string): string[] {
    const results: string[] = [];
    const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, "gs");
    let match;
    while ((match = regex.exec(xml)) !== null) {
      // This is a simplified parser, so we'll strip CDATA tags if they exist
      const content = match[1].replace('<![CDATA[', '').replace(']]>', '');
      results.push(content.trim());
    }
    return results;
  }

  private async searchWikipedia(query: string): Promise<MultiSourceResult> {
    try {
      const searchUrl = `${this.FREE_APIS.wikipedia}page/summary/${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);

      if (!response.ok) {
        return { source: 'wikipedia', available: false, results: [], searchQuery: query };
      }

      const data = await response.json();
      const evidence: AdvancedEvidence = {
        id: `wiki-${Date.now()}`,
        publisher: 'Wikipedia',
        url: data.content_urls?.desktop?.page || null,
        quote: data.extract || '',
        score: 75, // Wikipedia baseline reliability
        type: 'claim',
        sourceCredibility: 75,
        authorCredibility: 65, // Crowdsourced
        recency: 30, // Assume recent enough
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
      return { source: 'wikipedia', available: false, results: [], error: error.message, searchQuery: query };
    }
  }

  private async searchPubMed(query: string): Promise<MultiSourceResult> {
    try {
      const searchUrl = `${this.FREE_APIS.pubmed}esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5`;
      const response = await fetch(searchUrl);

      if (!response.ok) {
        return { source: 'pubmed', available: false, results: [], searchQuery: query };
      }

      const data = await response.json();
      const results: AdvancedEvidence[] = [];

      if (data.esearchresult?.idlist) {
        // Fetch details for each paper
        for (const id of data.esearchresult.idlist.slice(0, 3)) {
          const detailUrl = `${this.FREE_APIS.pubmed}esummary.fcgi?db=pubmed&id=${id}&retmode=json`;
          const detailResponse = await fetch(detailUrl);
          const detailData = await detailResponse.json();

          const paper = detailData.result[id];
          if (paper) {
            results.push({
              id: `pubmed-${id}`,
              publisher: 'PubMed',
              url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
              quote: paper.title,
              score: 92, // High reliability for peer-reviewed
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
      return { source: 'pubmed', available: false, results: [], error: error.message, searchQuery: query };
    }
  }

  private async scrapeFactCheckSites(query: string): Promise<MultiSourceResult> {
    // FIXME: This is a placeholder implementation.
    // In production, you'd want to use proper, respectful scraping methods.
    return {
      source: 'snopes',
      available: false,
      results: [],
      error: 'Web scraping not implemented in demo',
      searchQuery: query
    };
  }

  private async searchArXiv(query: string): Promise<MultiSourceResult> {
    try {
      const searchUrl = `${this.FREE_APIS.arxiv}query?search_query=all:${encodeURIComponent(query)}&max_results=5`;
      const response = await fetch(searchUrl);

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
            id: `arxiv-${id.split('/').pop()}`,
            publisher: 'arXiv',
            url: id,
            quote: `${title}. ${summary.replace(/\n/g, ' ')}`,
            score: 85, // arXiv baseline reliability
            type: 'claim',
            sourceCredibility: 85,
            authorCredibility: 80, // Academic authors
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
      return { source: 'arxiv', available: false, results: [], error: error.message, searchQuery: query };
    }
  }

  private async searchGoogleNews(query: string): Promise<MultiSourceResult> {
    try {
      const searchUrl = `${this.FREE_APIS.googleNews}${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);

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
        const description = this._parseXml(item, 'description')[0] || ''; // This might contain HTML

        if (title && link) {
          // Simplistic way to get a publisher name from the feed
          const source = this._parseXml(item, 'source')[0] || 'Google News';

          results.push({
            id: `googlenews-${Date.now()}-${Math.random()}`,
            publisher: source,
            url: link,
            quote: `${title}. ${description.replace(/<[^>]*>?/gm, '')}`, // Strip HTML from description
            score: 70, // Google News baseline reliability
            type: 'news',
            sourceCredibility: 70,
            authorCredibility: 65, // Varies wildly, so baseline is lower
            recency: calculateRecency(pubDate),
            relevanceScore: 75,
            contradictsClaim: false,
            supportsClaim: true,
            factCheckVerdict: 'unknown',
            biasScore: 0, // Cannot determine from RSS
            publishedDate: pubDate,
            lastVerified: new Date().toISOString(),
          });
        }
      }

      return {
        source: 'googleNews',
        available: results.length > 0,
        results: results.slice(0, 5), // Limit to 5 results
        searchQuery: query
      };
    } catch (error) {
      return { source: 'googleNews', available: false, results: [], error: error.message, searchQuery: query };
    }
  }
}
