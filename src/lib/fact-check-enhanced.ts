// ============================================================================
// SOURCE CREDIBILITY SYSTEM
// ============================================================================

interface SourceCredibility {
  domain: string;
  rating: number; // 0-100
  classification: 'highly-credible' | 'credible' | 'mixed' | 'low-credibility' | 'unknown';
  factors: {
    established: boolean;
    factCheckRecord: 'excellent' | 'good' | 'mixed' | 'poor' | 'unknown';
    transparency: 'high' | 'medium' | 'low';
    expertise: 'specialist' | 'general' | 'unknown';
  };
  warnings?: string[];
}

class SourceValidator {
  private credibilityDatabase: Map<string, SourceCredibility>;

  constructor() {
    this.credibilityDatabase = this.initializeCredibilityDatabase();
  }

  private initializeCredibilityDatabase(): Map<string, SourceCredibility> {
    const db = new Map<string, SourceCredibility>();

    // Tier 1: Highly Credible Sources (90-100)
    const tier1Sources = [
      'reuters.com', 'apnews.com', 'bbc.com', 'npr.org',
      'nature.com', 'science.org', 'pnas.org', 'thelancet.com',
      'nejm.org', 'who.int', 'cdc.gov', 'nih.gov',
      'arxiv.org', 'ieee.org', 'acm.org'
    ];

    tier1Sources.forEach(domain => {
      db.set(domain, {
        domain,
        rating: 95,
        classification: 'highly-credible',
        factors: {
          established: true,
          factCheckRecord: 'excellent',
          transparency: 'high',
          expertise: 'specialist'
        }
      });
    });

    // Tier 2: Credible Sources (75-89)
    const tier2Sources = [
      'nytimes.com', 'washingtonpost.com', 'theguardian.com',
      'wsj.com', 'economist.com', 'ft.com', 'bloomberg.com',
      'wikipedia.org', 'britannica.com', 'gov', 'edu'
    ];

    tier2Sources.forEach(domain => {
      db.set(domain, {
        domain,
        rating: 82,
        classification: 'credible',
        factors: {
          established: true,
          factCheckRecord: 'good',
          transparency: 'high',
          expertise: 'general'
        }
      });
    });

    // Tier 3: Mixed Sources (50-74)
    const tier3Sources = [
      'forbes.com', 'businessinsider.com', 'huffpost.com',
      'buzzfeednews.com', 'vox.com', 'medium.com'
    ];

    tier3Sources.forEach(domain => {
      db.set(domain, {
        domain,
        rating: 62,
        classification: 'mixed',
        factors: {
          established: true,
          factCheckRecord: 'mixed',
          transparency: 'medium',
          expertise: 'general'
        },
        warnings: ['Verify claims with additional sources']
      });
    });

    return db;
  }

  validateSource(url: string): SourceCredibility {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');

      // Check exact match
      if (this.credibilityDatabase.has(domain)) {
        return this.credibilityDatabase.get(domain)!;
      }

      // Check for partial matches (e.g., subdomains of .gov, .edu)
      for (const [knownDomain, credibility] of this.credibilityDatabase.entries()) {
        if (domain.endsWith(knownDomain)) {
          return credibility;
        }
      }

      // Domain pattern analysis for unknown sources
      return this.analyzeUnknownSource(domain);
    } catch (error) {
      return this.getUnknownSourceCredibility();
    }
  }

  private analyzeUnknownSource(domain: string): SourceCredibility {
    let rating = 50;
    const warnings: string[] = [];

    // Government domains
    if (domain.endsWith('.gov')) {
      rating = 85;
    }
    // Educational institutions
    else if (domain.endsWith('.edu')) {
      rating = 80;
    }
    // Organization domains
    else if (domain.endsWith('.org')) {
      rating = 60;
      warnings.push('Verify organization credibility');
    }
    // News-like domains
    else if (domain.includes('news') || domain.includes('times') || domain.includes('post')) {
      rating = 55;
      warnings.push('Unknown news source - verify independently');
    }
    // Blog or personal sites
    else if (domain.includes('blog') || domain.includes('wordpress') || domain.includes('blogspot')) {
      rating = 40;
      warnings.push('Personal blog - treat as opinion');
    }
    // Social media
    else if (['twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com'].some(sm => domain.includes(sm))) {
      rating = 30;
      warnings.push('Social media post - not a primary source');
    }

    return {
      domain,
      rating,
      classification: rating >= 75 ? 'credible' : rating >= 50 ? 'mixed' : 'low-credibility',
      factors: {
        established: rating >= 70,
        factCheckRecord: 'unknown',
        transparency: rating >= 70 ? 'medium' : 'low',
        expertise: 'unknown'
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private getUnknownSourceCredibility(): SourceCredibility {
    return {
      domain: 'unknown',
      rating: 40,
      classification: 'unknown',
      factors: {
        established: false,
        factCheckRecord: 'unknown',
        transparency: 'low',
        expertise: 'unknown'
      },
      warnings: ['Source could not be validated', 'Use with caution']
    };
  }

  calculateAggregateScore(sources: SourceCredibility[]): number {
    if (sources.length === 0) return 0;

    const totalRating = sources.reduce((sum, source) => sum + source.rating, 0);
    return Math.round(totalRating / sources.length);
  }
}

// ============================================================================
// ENHANCED SEARCH RESULT WITH SOURCE VALIDATION
// ============================================================================

interface ValidatedSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: SourceCredibility;
  relevanceScore: number;
  publishDate?: string;
  author?: string;
}

interface FactCheckEvidence {
  claim: string;
  verdict: 'true' | 'false' | 'partially-true' | 'misleading' | 'unverified';
  confidence: number;
  sources: ValidatedSearchResult[];
  aggregateCredibility: number;
  reasoning: string;
  lastUpdated: string;
}

import { RobustJSONParser } from '../utils/jsonParser';

// ============================================================================
// SMART QUERY OPTIMIZER
// ============================================================================

class QueryOptimizer {
  /**
   * Extracts key entities and builds optimal search queries
   */
  static optimizeForSearch(text: string, maxLength: number): string {
    // Remove URLs, emails, and special characters
    let cleaned = text
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\S+@\S+\.\S+/g, '')
      .replace(/[^\w\s.,'"-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    // Extract named entities and key phrases
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim());

    // Prioritize sentences with proper nouns (capitalized words)
    const scoredSentences = sentences.map(sentence => {
      const words = sentence.trim().split(/\s+/);
      const properNouns = words.filter(w => /^[A-Z]/.test(w)).length;
      const numbers = words.filter(w => /\d/.test(w)).length;
      const score = properNouns * 3 + numbers * 2 + (words.length > 5 ? 1 : 0);
      return { sentence: sentence.trim(), score };
    });

    scoredSentences.sort((a, b) => b.score - a.score);

    // Build query from highest-scoring sentences
    let optimized = '';
    for (const { sentence } of scoredSentences) {
      if ((optimized + ' ' + sentence).length <= maxLength) {
        optimized += (optimized ? ' ' : '') + sentence;
      } else {
        break;
      }
    }

    // Fallback: just truncate intelligently
    if (!optimized) {
      optimized = cleaned.substring(0, maxLength);
      const lastSpace = optimized.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        optimized = optimized.substring(0, lastSpace);
      }
    }

    return optimized.trim();
  }

  /**
   * Builds multiple search query variations
   */
  static generateQueryVariations(originalQuery: string, count: number = 3): string[] {
    const queries = [originalQuery];

    // Extract key terms (proper nouns, numbers, significant words)
    const words = originalQuery.split(/\s+/);
    const keyTerms = words.filter(w =>
      /^[A-Z]/.test(w) || // Proper noun
      /\d/.test(w) || // Contains number
      w.length > 6 // Long word (likely significant)
    );

    if (keyTerms.length >= 3) {
      // Create focused query with key terms
      queries.push(keyTerms.slice(0, 5).join(' '));
    }

    // Create broader query (first half)
    if (words.length > 10) {
      queries.push(words.slice(0, Math.ceil(words.length / 2)).join(' '));
    }

    return queries.slice(0, count);
  }
}

// ============================================================================
// ENHANCED FACT-CHECK SERVICE
// ============================================================================

class EnhancedFactCheckService {
  private sourceValidator: SourceValidator;

  constructor() {
    this.sourceValidator = new SourceValidator();
  }

  async searchWithValidation(query: string): Promise<ValidatedSearchResult[]> {
    const optimizedQuery = QueryOptimizer.optimizeForSearch(query, 80);

    console.log(`🔍 Optimized query: "${optimizedQuery}" (${optimizedQuery.length} chars)`);

    try {
      // Call your SERP API
      const response = await fetch('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: optimizedQuery })
      });

      if (!response.ok) {
        throw new Error(`SERP API error: ${response.status}`);
      }

      const data = await response.json();

      // Validate and enrich results
      const validatedResults: ValidatedSearchResult[] = (data.organic || []).map((result: any) => {
        const sourceCredibility = this.sourceValidator.validateSource(result.link);

        return {
          title: result.title,
          url: result.link,
          snippet: result.snippet || '',
          source: sourceCredibility,
          relevanceScore: this.calculateRelevance(result, optimizedQuery),
          publishDate: result.date
        };
      });

      // Sort by credibility and relevance
      validatedResults.sort((a, b) => {
        const scoreA = (a.source.rating * 0.6) + (a.relevanceScore * 0.4);
        const scoreB = (b.source.rating * 0.6) + (b.relevanceScore * 0.4);
        return scoreB - scoreA;
      });

      console.log(`✅ Found ${validatedResults.length} validated sources`);
      console.log(`📊 Aggregate credibility: ${this.sourceValidator.calculateAggregateScore(validatedResults.map(r => r.source))}`);

      return validatedResults;
    } catch (error) {
      console.error('Search with validation failed:', error);
      return [];
    }
  }

  async searchWithRawQuery(query: string): Promise<ValidatedSearchResult[]> {
    console.log(`🔍 Raw query: "${query}"`);

    try {
      // Call your SERP API
      const response = await fetch('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query }) // Use raw query
      });

      if (!response.ok) {
        throw new Error(`SERP API error: ${response.status}`);
      }

      const data = await response.json();

      // Validate and enrich results
      const validatedResults: ValidatedSearchResult[] = (data.organic || []).map((result: any) => {
        const sourceCredibility = this.sourceValidator.validateSource(result.link);

        return {
          title: result.title,
          url: result.link,
          snippet: result.snippet || '',
          source: sourceCredibility,
          relevanceScore: this.calculateRelevance(result, query), // Calculate relevance against raw query
          publishDate: result.date
        };
      });

      // Sort by credibility and relevance
      validatedResults.sort((a, b) => {
        const scoreA = (a.source.rating * 0.6) + (a.relevanceScore * 0.4);
        const scoreB = (b.source.rating * 0.6) + (b.relevanceScore * 0.4);
        return scoreB - scoreA;
      });

      console.log(`✅ Found ${validatedResults.length} validated sources from raw query`);

      return validatedResults;
    } catch (error) {
      console.error('Search with raw query failed:', error);
      return [];
    }
  }

  private calculateRelevance(result: any, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const text = `${result.title} ${result.snippet}`.toLowerCase();

    const matches = queryTerms.filter(term => text.includes(term)).length;
    return Math.min(100, (matches / queryTerms.length) * 100);
  }

  async searchNewsWithValidation(query: string, fromDate?: string): Promise<ValidatedSearchResult[]> {
    const optimizedQuery = QueryOptimizer.optimizeForSearch(query, 75);

    console.log(`📰 News search query: "${optimizedQuery}" (${optimizedQuery.length} chars)`);

    try {
      const response = await fetch('/api/webz-news-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: optimizedQuery,
          fromDate
        })
      });

      if (!response.ok) {
        console.error(`News API error: ${response.status}`);
        return [];
      }

      const data = await response.json();

      const validatedResults: ValidatedSearchResult[] = (data.posts || []).map((post: any) => {
        const sourceCredibility = this.sourceValidator.validateSource(post.thread?.url || post.url);

        return {
          title: post.thread?.title || post.title,
          url: post.thread?.url || post.url,
          snippet: post.text?.substring(0, 200) || '',
          source: sourceCredibility,
          relevanceScore: 85, // News results are generally relevant
          publishDate: post.published,
          author: post.author
        };
      });

      console.log(`✅ Found ${validatedResults.length} news sources`);

      return validatedResults;
    } catch (error) {
      console.error('News search failed:', error);
      return [];
    }
  }

  buildFactCheckReport(claim: string, sources: ValidatedSearchResult[]): FactCheckEvidence {
    const aggregateCredibility = this.sourceValidator.calculateAggregateScore(
      sources.map(s => s.source)
    );

    // Simple verdict logic (expand based on your needs)
    let verdict: FactCheckEvidence['verdict'] = 'unverified';
    let confidence = 0;

    if (sources.length >= 3 && aggregateCredibility >= 80) {
      verdict = 'true';
      confidence = 85;
    } else if (sources.length >= 2 && aggregateCredibility >= 70) {
      verdict = 'partially-true';
      confidence = 70;
    } else if (sources.length >= 1) {
      verdict = 'unverified';
      confidence = 50;
    }

    return {
      claim,
      verdict,
      confidence,
      sources,
      aggregateCredibility,
      reasoning: this.generateReasoning(sources, aggregateCredibility),
      lastUpdated: new Date().toISOString()
    };
  }

  private generateReasoning(sources: ValidatedSearchResult[], aggregateScore: number): string {
    if (sources.length === 0) {
      return 'No reliable sources found to verify this claim.';
    }

    const highCredSources = sources.filter(s => s.source.rating >= 80).length;
    const medCredSources = sources.filter(s => s.source.rating >= 60 && s.source.rating < 80).length;

    let reasoning = `Found ${sources.length} source(s) with aggregate credibility of ${aggregateScore}/100. `;

    if (highCredSources > 0) {
      reasoning += `${highCredSources} highly credible source(s). `;
    }
    if (medCredSources > 0) {
      reasoning += `${medCredSources} moderately credible source(s). `;
    }

    return reasoning;
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

export {
  SourceValidator,
  QueryOptimizer,
  EnhancedFactCheckService,
  type SourceCredibility,
  type ValidatedSearchResult,
  type FactCheckEvidence
};