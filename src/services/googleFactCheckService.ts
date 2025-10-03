// src/services/googleFactCheckService.ts - FIXED VERSION

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

  static getInstance(): GoogleFactCheckService {
    if (!GoogleFactCheckService.instance) {
      GoogleFactCheckService.instance = new GoogleFactCheckService();
    }
    return GoogleFactCheckService.instance;
  }

  async searchClaims(claimText: string, maxResults: number = 5): Promise<GoogleFactCheckResult[]> {
    const factCheckQuery = this.createFactCheckQuery(claimText, maxResults);

    const cacheKey = this.cache.generateKey('google_fact_check', await generateSHA256(claimText));

    const cached = await this.cache.get<GoogleFactCheckResult[]>(cacheKey);
    if (cached) {
      console.log('✅ Using cached fact-check results');
      return cached;
    }

    try {
      const response = await this.httpClient.request<any>('/api/serp-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: factCheckQuery,
          num: maxResults
        }),
        timeout: 15000,
        retryConfig: { maxRetries: 2 }
      });

      if (!response) {
        console.warn('Empty response from SERP API for fact-check');
        return [];
      }

      const results = this.extractResults(response);

      if (results.length === 0) {
        console.log('ℹ️  No fact-check results found');
        return [];
      }

      const transformedResults = this.transformSerpResults(results, claimText);

      await this.cache.set(cacheKey, transformedResults, 'factCheckTTL');

      console.log(`✅ Fact-check search returned ${transformedResults.length} results`);
      return transformedResults;

    } catch (error) {
      console.error('Fact-check search error:', error);
      return [];
    }
  }

  private createFactCheckQuery(claimText: string, maxResults: number): string {
    const sentences = claimText.match(/[^.!?]+[.!?]+/g) || [claimText];
    const keyPhrase = sentences[0].substring(0, 80).trim();

    const factCheckSites = [
      'site:factcheck.org',
      'site:politifact.com',
      'site:snopes.com',
      'site:reuters.com/fact-check',
      'site:apnews.com/hub/fact-checking',
      'site:fullfact.org'
    ];

    return `${keyPhrase} ${factCheckSites.join(' OR ')}`;
  }

  private extractResults(response: any): any[] {
    if (response.results && Array.isArray(response.results)) {
      return response.results;
    }

    if (response.organic && Array.isArray(response.organic)) {
      return response.organic;
    }

    if (response.organic_results && Array.isArray(response.organic_results)) {
      return response.organic_results;
    }

    if (response.items && Array.isArray(response.items)) {
      return response.items;
    }

    if (Array.isArray(response)) {
      return response;
    }

    console.warn('Unknown SERP response format for fact-check:', Object.keys(response));
    return [];
  }

  private transformSerpResults(results: any[], originalClaim: string): GoogleFactCheckResult[] {
    return results
      .filter(result => this.isFactCheckSource(result))
      .map(result => {
        const rating = this.extractRating(result);

        return {
          text: result.title || originalClaim,
          claimant: this.extractClaimant(result),
          claimDate: this.extractDate(result) || new Date().toISOString(),
          claimReview: [
            {
              publisher: this.extractPublisher(result),
              url: result.link || result.url || '',
              title: result.title || 'Fact Check',
              reviewRating: rating
            }
          ],
          languageCode: 'en'
        };
      });
  }

  private isFactCheckSource(result: any): boolean {
    const url = (result.link || result.url || '').toLowerCase();
    const source = (result.source || result.displayLink || '').toLowerCase();

    const factCheckDomains = [
      'factcheck.org',
      'politifact.com',
      'snopes.com',
      'reuters.com/fact-check',
      'apnews.com/hub/fact-checking',
      'fullfact.org',
      'africacheck.org',
      'factcheck.afp.com'
    ];

    return factCheckDomains.some(domain =>
      url.includes(domain) || source.includes(domain)
    );
  }

  private extractRating(result: any): {
    ratingValue: number;
    textualRating: string;
    worstRating: number;
    bestRating: number;
  } {
    const snippet = (result.snippet || result.description || '').toLowerCase();
    const title = (result.title || '').toLowerCase();
    const combinedText = `${title} ${snippet}`;

    const ratingKeywords = {
      true: ['true', 'accurate', 'correct', 'verified', 'confirmed'],
      mostlyTrue: ['mostly true', 'mostly accurate', 'largely true'],
      mixed: ['mixed', 'half true', 'partially true', 'partially false'],
      mostlyFalse: ['mostly false', 'mostly inaccurate', 'largely false'],
      false: ['false', 'incorrect', 'inaccurate', 'debunked', 'pants on fire', 'fake']
    };

    let ratingValue = 3;
    let textualRating = 'Unrated';

    if (ratingKeywords.true.some(kw => combinedText.includes(kw))) {
      ratingValue = 5;
      textualRating = 'True';
    } else if (ratingKeywords.mostlyTrue.some(kw => combinedText.includes(kw))) {
      ratingValue = 4;
      textualRating = 'Mostly True';
    } else if (ratingKeywords.mixed.some(kw => combinedText.includes(kw))) {
      ratingValue = 3;
      textualRating = 'Mixed';
    } else if (ratingKeywords.mostlyFalse.some(kw => combinedText.includes(kw))) {
      ratingValue = 2;
      textualRating = 'Mostly False';
    } else if (ratingKeywords.false.some(kw => combinedText.includes(kw))) {
      ratingValue = 1;
      textualRating = 'False';
    }

    return {
      ratingValue,
      textualRating,
      worstRating: 1,
      bestRating: 5
    };
  }

  private extractPublisher(result: any): string {
    const url = result.link || result.url || '';

    const publishers: Record<string, string> = {
      'factcheck.org': 'FactCheck.org',
      'politifact.com': 'PolitiFact',
      'snopes.com': 'Snopes',
      'reuters.com': 'Reuters Fact Check',
      'apnews.com': 'AP Fact Check',
      'fullfact.org': 'Full Fact',
      'africacheck.org': 'Africa Check',
      'factcheck.afp.com': 'AFP Fact Check'
    };

    for (const [domain, name] of Object.entries(publishers)) {
      if (url.includes(domain)) {
        return name;
      }
    }

    return result.source || result.displayLink || 'Fact Checker';
  }

  private extractClaimant(result: any): string {
    const snippet = result.snippet || result.description || '';

    const claimantPatterns = [
      /claim(?:s|ed)?\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:said|claimed|stated)/i,
      /according\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    ];

    for (const pattern of claimantPatterns) {
      const match = snippet.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'Unknown';
  }

  private extractDate(result: any): string | null {
    const snippet = result.snippet || result.description || '';
    const title = result.title || '';
    const combinedText = `${title} ${snippet}`;

    const datePatterns = [
      /\b\d{4}-\d{2}-\d{2}\b/,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/
    ];

    for (const pattern of datePatterns) {
      const match = combinedText.match(pattern);
      if (match) {
        try {
          return new Date(match[0]).toISOString();
        } catch {
          continue;
        }
      }
    }

    return null;
  }
}