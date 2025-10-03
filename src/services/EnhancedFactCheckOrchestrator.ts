// src/services/EnhancedFactCheckOrchestrator.ts
// REAL API INTEGRATION - NO MOCK DATA

import {
  EnhancedFactCheckService,
  QueryOptimizer,
  RobustJSONParser,
  type FactCheckEvidence,
  type ValidatedSearchResult
} from '../lib/fact-check-enhanced';

interface FactCheckConfig {
  maxQueryLength: number;
  enableNewsSearch: boolean;
  newsLookbackDays: number;
  retryAttempts: number;
}

export class EnhancedFactCheckOrchestrator {
  private enhancedService: EnhancedFactCheckService;
  private config: FactCheckConfig;

  constructor(config?: Partial<FactCheckConfig>) {
    this.enhancedService = new EnhancedFactCheckService();
    this.config = {
      maxQueryLength: 80,
      enableNewsSearch: true,
      newsLookbackDays: 30,
      retryAttempts: 3,
      ...config
    };
  }

  /**
   * Main entry point - replaces performTieredCheck
   * USES REAL API CALLS ONLY
   */
  async performFactCheck(articleText: string): Promise<FactCheckEvidence> {
    console.log('🎯 Starting Enhanced Fact Check (Real APIs)');
    console.log(`📄 Article length: ${articleText.length} characters`);

    try {
      // Phase 1: Extract primary claim using REAL Gemini API
      const primaryClaim = await this.extractPrimaryClaim(articleText);
      console.log(`💡 Primary claim extracted: "${primaryClaim}"`);

      // Phase 2: Optimize query for API constraints
      const optimizedQuery = QueryOptimizer.optimizeForSearch(
        primaryClaim,
        this.config.maxQueryLength
      );
      console.log(`🔍 Optimized query: "${optimizedQuery}" (${optimizedQuery.length} chars)`);

      // Phase 3: REAL SERP API search with retries
      let searchResults = await this.searchWithRetry(optimizedQuery);
      console.log(`📊 SERP API found: ${searchResults.length} sources`);

      // Phase 4: REAL Webz.io News API search
      if (this.config.enableNewsSearch && this.hasTemporalElements(articleText)) {
        console.log('📅 Temporal elements detected, searching news via Webz.io...');
        const newsResults = await this.searchNewsWithRetry(optimizedQuery);
        console.log(`📰 Webz.io API found: ${newsResults.length} sources`);
        searchResults = [...searchResults, ...newsResults];
      }

      // Phase 5: If no results, try alternative queries (REAL APIs)
      if (searchResults.length === 0) {
        console.log('⚠️ No results found, trying alternative queries...');
        searchResults = await this.tryAlternativeQueries(articleText);
      }

      // Phase 6: Build final report with REAL source validation
      const evidence = this.enhancedService.buildFactCheckReport(
        primaryClaim,
        searchResults
      );

      console.log('✅ Fact check complete with REAL data');
      console.log(`📈 Verdict: ${evidence.verdict}`);
      console.log(`🎯 Confidence: ${evidence.confidence}%`);
      console.log(`⭐ Aggregate credibility: ${evidence.aggregateCredibility}/100`);

      // Phase 7: Save to REAL Vercel Blob storage
      await this.saveResults(evidence);

      return evidence;

    } catch (error) {
      console.error('❌ Fact check failed:', error);

      // Return error state (not mock data)
      return {
        claim: articleText.substring(0, 200) + '...',
        verdict: 'unverified',
        confidence: 0,
        sources: [],
        aggregateCredibility: 0,
        reasoning: `Fact check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Extract primary claim using REAL Gemini API
   */
  private async extractPrimaryClaim(text: string): Promise<string> {
    const geminiApiKey = this.getApiKey('gemini');

    if (!geminiApiKey) {
      console.warn('⚠️ Gemini API key not found, using fallback extraction');
      return this.fallbackClaimExtraction(text);
    }

    try {
      const prompt = `Extract the single most important factual claim from this text. Return ONLY valid JSON:
{
  "primaryClaim": "the main verifiable claim"
}

Text:
${text.substring(0, 2000)}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1024
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Use robust JSON parser
      const parsed = RobustJSONParser.parse<{ primaryClaim: string }>(aiResponse);

      if (parsed.primaryClaim && parsed.primaryClaim.length > 0) {
        return parsed.primaryClaim;
      }

      throw new Error('No claim extracted from AI response');

    } catch (error) {
      console.warn('AI extraction failed, using fallback:', error);
      return this.fallbackClaimExtraction(text);
    }
  }

  /**
   * Fallback extraction (no AI, no mock data)
   */
  private fallbackClaimExtraction(text: string): string {
    // Extract first meaningful sentence with proper nouns/numbers
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => {
        // Must have: length 20-300, capital letter, and number or proper noun
        return s.length > 20 &&
               s.length < 300 &&
               /[A-Z]/.test(s) &&
               (/\d/.test(s) || /[A-Z][a-z]+\s[A-Z]/.test(s));
      });

    return sentences[0] || text.substring(0, 200);
  }

  /**
   * Search with retry - REAL SERP API only
   */
  private async searchWithRetry(query: string): Promise<ValidatedSearchResult[]> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔍 SERP API attempt ${attempt}/${this.config.retryAttempts}`);

        const results = await this.enhancedService.searchWithValidation(query);

        if (results.length > 0) {
          console.log(`✅ SERP API success: ${results.length} results`);
          return results;
        }

        console.log(`⚠️ Attempt ${attempt}: No results, retrying...`);

      } catch (error) {
        console.error(`❌ SERP API attempt ${attempt} failed:`, error);

        if (attempt === this.config.retryAttempts) {
          throw new Error(`SERP API failed after ${attempt} attempts: ${error}`);
        }

        // Exponential backoff
        await this.delay(1000 * Math.pow(2, attempt - 1));
      }
    }

    return [];
  }

  /**
   * Search news - REAL Webz.io API only
   */
  private async searchNewsWithRetry(query: string): Promise<ValidatedSearchResult[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - this.config.newsLookbackDays);

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`📰 Webz.io API attempt ${attempt}/${this.config.retryAttempts}`);

        const results = await this.enhancedService.searchNewsWithValidation(
          query,
          fromDate.toISOString()
        );

        console.log(`✅ Webz.io API success: ${results.length} results`);
        return results;

      } catch (error) {
        console.error(`❌ Webz.io API attempt ${attempt} failed:`, error);

        if (attempt === this.config.retryAttempts) {
          console.warn('All Webz.io attempts failed, continuing without news results');
          return [];
        }

        await this.delay(1000 * attempt);
      }
    }

    return [];
  }

  /**
   * Try alternative queries - REAL APIs only
   */
  private async tryAlternativeQueries(articleText: string): Promise<ValidatedSearchResult[]> {
    console.log('🔄 Generating alternative queries...');

    const queries = QueryOptimizer.generateQueryVariations(articleText, 3);

    for (const [index, query] of queries.entries()) {
      console.log(`🔍 Alternative query ${index + 1}/3: "${query}"`);

      try {
        const results = await this.enhancedService.searchWithValidation(query);

        if (results.length > 0) {
          console.log(`✅ Alternative query ${index + 1} succeeded: ${results.length} results`);
          return results;
        }

      } catch (error) {
        console.error(`❌ Alternative query ${index + 1} failed:`, error);
      }

      // Small delay between attempts
      await this.delay(500);
    }

    console.log('❌ All alternative queries returned no results');
    return [];
  }

  /**
   * Detect temporal elements
   */
  private hasTemporalElements(text: string): boolean {
    const temporalPatterns = [
      /\b(20\d{2})\b/,                  // Year (2024)
      /\d{1,2}\/\d{1,2}\/\d{2,4}/,     // Date (10/01/2024)
      /\b(today|yesterday|tomorrow)\b/i,
      /\b(recently|latest|current)\b/i,
      /\b(last|this|next)\s+(week|month|year)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i
    ];

    return temporalPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Save results to REAL Vercel Blob storage
   */
  private async saveResults(evidence: FactCheckEvidence): Promise<void> {
    try {
      const report = {
        id: `factcheck_${Date.now()}`,
        timestamp: new Date().toISOString(),
        evidence,
        version: '2.0'
      };

      const response = await fetch('/api/blob/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Report saved to Vercel Blob:', data.url);
      } else {
        const error = await response.text();
        console.warn('⚠️ Failed to save report:', error);
      }
    } catch (error) {
      console.error('❌ Blob storage save failed:', error);
      // Don't throw - saving is optional
    }
  }

  /**
   * Get API key from environment or localStorage
   */
  private getApiKey(service: 'gemini' | 'serp' | 'webz'): string | null {
    // Try localStorage first (user-provided keys)
    if (typeof window !== 'undefined') {
      const storageKey = `${service.toUpperCase()}_API_KEY`;
      const key = window.localStorage.getItem(storageKey);
      if (key) {
        console.log(`✅ Using ${service} API key from localStorage`);
        return key;
      }
    }

    // Fallback to environment (server-side)
    if (typeof process !== 'undefined' && process.env) {
      const envKey = process.env[`${service.toUpperCase()}_API_KEY`];
      if (envKey) {
        console.log(`✅ Using ${service} API key from environment`);
        return envKey;
      }
    }

    console.warn(`⚠️ No ${service} API key found`);
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public: Check single claim (REAL APIs)
   */
  async checkClaim(claim: string): Promise<FactCheckEvidence> {
    const optimizedQuery = QueryOptimizer.optimizeForSearch(claim, this.config.maxQueryLength);
    const sources = await this.searchWithRetry(optimizedQuery);
    return this.enhancedService.buildFactCheckReport(claim, sources);
  }

  /**
   * Public: Batch check (REAL APIs)
   */
  async checkMultipleClaims(claims: string[]): Promise<FactCheckEvidence[]> {
    console.log(`🔄 Batch checking ${claims.length} claims (REAL APIs)...`);

    const results: FactCheckEvidence[] = [];

    for (const [index, claim] of claims.entries()) {
      console.log(`Checking claim ${index + 1}/${claims.length}`);

      try {
        const evidence = await this.checkClaim(claim);
        results.push(evidence);

        // Rate limiting between requests
        if (index < claims.length - 1) {
          await this.delay(1000);
        }
      } catch (error) {
        console.error(`Failed to check claim ${index + 1}:`, error);
        results.push({
          claim,
          verdict: 'unverified',
          confidence: 0,
          sources: [],
          aggregateCredibility: 0,
          reasoning: `Failed to verify: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastUpdated: new Date().toISOString()
        });
      }
    }

    return results;
  }

  getConfig(): FactCheckConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<FactCheckConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('✅ Configuration updated:', this.config);
  }
}

export default EnhancedFactCheckOrchestrator;
