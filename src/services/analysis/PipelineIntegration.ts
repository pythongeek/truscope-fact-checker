// src/services/analysis/PipelineIntegration.ts
// FIXED VERSION - Resolves evidence aggregation and result parsing issues

import { AdvancedQueryPipeline, PipelineResult, RankedQuery } from '@/services/analysis/AdvancedQueryPipeline';
import { SerpApiService } from '@/services/serpApiService';
import { GoogleFactCheckService } from '@/services/googleFactCheckService';
import { WebSearchService } from '@/services/webSearchService';
import { EvidenceItem } from '@/types';

export interface EnhancedSearchResult {
    pipelineResult: PipelineResult;
    searchResults: {
        immediate: Map<string, any[]>;
        followUp: Map<string, any[]>;
        deepDive: Map<string, any[]>;
    };
    aggregatedEvidence: EvidenceItem[];
    executionMetrics: {
        totalQueriesExecuted: number;
        totalResultsReturned: number;
        averageQueryTime: number;
        phaseTimings: {
            phase1: number;
            phase2: number;
            phase3: number;
        };
    };
}

export class PipelineIntegration {
    private static instance: PipelineIntegration;
    private pipeline: AdvancedQueryPipeline;
    private serpApi: SerpApiService;
    private factCheckApi: GoogleFactCheckService;
    private webSearch: WebSearchService;

    private constructor() {
        this.pipeline = AdvancedQueryPipeline.getInstance();
        this.serpApi = SerpApiService.getInstance();
        this.factCheckApi = GoogleFactCheckService.getInstance();
        this.webSearch = WebSearchService.getInstance();
    }

    static getInstance(): PipelineIntegration {
        if (!PipelineIntegration.instance) {
            PipelineIntegration.instance = new PipelineIntegration();
        }
        return PipelineIntegration.instance;
    }

    async processAndSearch(
        text: string,
        options: {
            executePhase2?: boolean;
            executePhase3?: boolean;
            maxResultsPerQuery?: number;
        } = {}
    ): Promise<EnhancedSearchResult> {
        const {
            executePhase2 = true,
            executePhase3 = false,
            maxResultsPerQuery = 10
        } = options;

        console.log('🔄 Starting Pipeline Integration...');
        const integrationStart = Date.now();

        const pipelineResult = await this.pipeline.processText(text);

        const searchResults = {
            immediate: new Map<string, any[]>(),
            followUp: new Map<string, any[]>(),
            deepDive: new Map<string, any[]>()
        };

        const phaseTimings = { phase1: 0, phase2: 0, phase3: 0 };

        // Phase 1: Immediate queries
        const phase1Start = Date.now();
        await this.executeQueries(
            pipelineResult.executionPlan.immediate,
            searchResults.immediate,
            maxResultsPerQuery
        );
        phaseTimings.phase1 = Date.now() - phase1Start;
        console.log(`✅ Phase 1 completed in ${phaseTimings.phase1}ms`);

        // Phase 2: Follow-up queries
        if (executePhase2) {
            const phase2Start = Date.now();
            await this.executeQueries(
                pipelineResult.executionPlan.followUp,
                searchResults.followUp,
                maxResultsPerQuery
            );
            phaseTimings.phase2 = Date.now() - phase2Start;
            console.log(`✅ Phase 2 completed in ${phaseTimings.phase2}ms`);
        }

        // Phase 3: Deep dive queries
        if (executePhase3) {
            const phase3Start = Date.now();
            await this.executeQueries(
                pipelineResult.executionPlan.deepDive,
                searchResults.deepDive,
                maxResultsPerQuery
            );
            phaseTimings.phase3 = Date.now() - phase3Start;
            console.log(`✅ Phase 3 completed in ${phaseTimings.phase3}ms`);
        }

        // ⚠️ FIX: Enhanced evidence aggregation with better result parsing
        const aggregatedEvidence = this.aggregateEvidence(searchResults, pipelineResult);

        const totalQueriesExecuted =
            searchResults.immediate.size +
            searchResults.followUp.size +
            searchResults.deepDive.size;

        const totalResultsReturned = [
            ...searchResults.immediate.values(),
            ...searchResults.followUp.values(),
            ...searchResults.deepDive.values()
        ].reduce((sum, results) => sum + results.length, 0);

        const totalTime = Date.now() - integrationStart;
        const averageQueryTime = totalQueriesExecuted > 0
            ? Math.round(totalTime / totalQueriesExecuted)
            : 0;

        console.log(`✅ Integration completed in ${totalTime}ms`);
        console.log(`    - Queries executed: ${totalQueriesExecuted}`);
        console.log(`    - Results returned: ${totalResultsReturned}`);
        console.log(`    - Evidence items: ${aggregatedEvidence.length}`);

        return {
            pipelineResult,
            searchResults,
            aggregatedEvidence,
            executionMetrics: {
                totalQueriesExecuted,
                totalResultsReturned,
                averageQueryTime,
                phaseTimings
            }
        };
    }

    private async executeQueries(
        queries: RankedQuery[],
        resultsMap: Map<string, any[]>,
        maxResults: number
    ): Promise<void> {
        if (queries.length === 0) return;

        const concurrencyLimit = 3;
        const batches = this.chunkArray(queries, concurrencyLimit);

        for (const batch of batches) {
            await Promise.all(
                batch.map(async (query) => {
                    try {
                        const searchString = this.buildSearchString(query);
                        const results = await this.executeSearchQuery(searchString, query, maxResults);
                        
                        // ⚠️ FIX: Ensure results are stored even if empty
                        resultsMap.set(query.queryId, results || []);

                        // ⚠️ FIX: Better relevance calculation
                        const relevantCount = results ? results.filter((r: any) => 
                            this.isRelevantResult(r, query)
                        ).length : 0;

                        this.pipeline.recordQueryEffectiveness({
                            queryId: query.queryId,
                            resultsReturned: results?.length || 0,
                            relevantResults: relevantCount,
                            authoritativeSources: results ? results.filter((r: any) => 
                                this.isAuthoritativeSource(r)
                            ).length : 0,
                            executionTime: 0
                        });

                    } catch (error) {
                        console.error(`❌ Query ${query.queryId} failed:`, error);
                        resultsMap.set(query.queryId, []);
                    }
                })
            );
        }
    }

    private buildSearchString(query: RankedQuery): string {
        let searchString = query.queryText;
        
        // Remove site operators as they may cause issues with some APIs
        const nonSiteOperators = query.searchOperators.filter(op => op.type !== 'site');
        
        nonSiteOperators.forEach(op => {
            switch (op.type) {
                case 'intitle':
                    searchString += ` intitle:"${op.value}"`;
                    break;
                case 'inurl':
                    searchString += ` inurl:${op.value}`;
                    break;
                case 'filetype':
                    searchString += ` filetype:${op.value}`;
                    break;
                case 'before':
                    searchString += ` before:${op.value}`;
                    break;
                case 'after':
                    searchString += ` after:${op.value}`;
                    break;
            }
        });
        
        return searchString.trim();
    }

    private async executeSearchQuery(
        searchString: string,
        query: RankedQuery,
        maxResults: number
    ): Promise<any[]> {
        const expectedTypes = query.expectedSourceTypes;

        try {
            // Route based on expected source types
            if (expectedTypes.includes('fact-check')) {
                const report = await this.factCheckApi.searchClaims(searchString, maxResults);
                const evidence = report ? report.evidence : [];
                console.log(`🔍 Fact-check search returned ${evidence.length} results`);
                return evidence;
            } else {
                // ⚠️ FIX: Use SERP API directly for better results
                const serpResults = await this.serpApi.search(searchString, maxResults);
                console.log(`🔍 SERP search returned ${serpResults.results?.length || 0} results`);
                return serpResults.results || [];
            }
        } catch (error) {
            console.error(`❌ Search query failed for "${searchString}":`, error);
            return [];
        }
    }

    private isRelevantResult(result: any, query: RankedQuery): boolean {
        // ⚠️ FIX: Better null checking and text extraction
        const title = result.title || result.text || '';
        const snippet = result.snippet || result.description || result.quote || '';
        const resultText = `${title} ${snippet}`.toLowerCase();

        if (!resultText.trim()) return false;

        const queryTerms = query.queryText
            .toLowerCase()
            .split(/\s+/)
            .filter(t => t.length > 3 && !['site:', 'intitle:', 'inurl:'].some(op => t.includes(op)));

        if (queryTerms.length === 0) return true;

        const matchCount = queryTerms.filter(term => resultText.includes(term)).length;
        return matchCount >= Math.max(1, Math.ceil(queryTerms.length * 0.3)); // At least 30% match
    }

    private isAuthoritativeSource(result: any): boolean {
        const url = (result.link || result.url || '').toLowerCase();
        const source = (result.source || result.publisher || '').toLowerCase();
        
        const authoritativeDomains = [
            'factcheck.org', 'politifact.com', 'snopes.com', 
            'reuters.com', 'apnews.com', 'bbc.com', 
            'nytimes.com', 'washingtonpost.com', 'theguardian.com',
            '.gov', '.edu', 'who.int', 'cdc.gov'
        ];
        
        return authoritativeDomains.some(domain =>
            url.includes(domain) || source.includes(domain)
        );
    }

    // ⚠️ CRITICAL FIX: Complete rewrite of evidence aggregation
    private aggregateEvidence(
      searchResults: {
          immediate: Map<string, any[]>;
          followUp: Map<string, any[]>;
          deepDive: Map<string, any[]>;
      },
      pipelineResult: PipelineResult
    ): EvidenceItem[] {
      console.log('🔄 Starting evidence aggregation...');
      
      // Collect all results
      const allResults = [
          ...Array.from(searchResults.immediate.values()),
          ...Array.from(searchResults.followUp.values()),
          ...Array.from(searchResults.deepDive.values())
      ].flat();

      console.log(`📊 Raw results collected: ${allResults.length}`);

      if (allResults.length === 0) {
          console.warn('⚠️ No results to aggregate!');
          return [];
      }

      // ⚠️ FIX: Better deduplication with multiple URL formats
      const uniqueResults = new Map<string, any>();
      
      allResults.forEach(result => {
          // Extract URL with multiple fallbacks
          const url = this.extractUrl(result);
          
          if (url) {
              const normalizedUrl = this.normalizeUrl(url);
              if (!uniqueResults.has(normalizedUrl)) {
                  uniqueResults.set(normalizedUrl, result);
              }
          } else {
              // Keep results without URLs using title as key
              const titleKey = `no-url-${result.title || result.text || Math.random()}`;
              if (!uniqueResults.has(titleKey)) {
                  uniqueResults.set(titleKey, result);
              }
          }
      });

      console.log(`📊 Unique results after deduplication: ${uniqueResults.size}`);

      // ⚠️ FIX: Enhanced evidence conversion with better field mapping
      const evidence: EvidenceItem[] = Array.from(uniqueResults.values()).map((result, index) => {
          const url = this.extractUrl(result);
          const publisher = this.extractPublisher(result);
          const quote = this.extractQuote(result);
          const score = this.calculateEvidenceScore(result);
          const type = this.determineEvidenceType(result);

          const title = result.title || quote.substring(0, 80);
          const snippet = this.extractQuote(result);

          return {
              id: `evidence-${index + 1}`,
              publisher,
              url,
              quote,
              credibilityScore: score,
              relevanceScore: score,
              type,
              title,
              snippet,
              source: {
                  name: publisher,
                  url: url,
                  credibility: {
                      rating: score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low',
                      classification: this.classifySource(result),
                      warnings: score < 50 ? ['Lower credibility source'] : [],
                  }
              }
          };
      });

      // Sort by score (descending)
      evidence.sort((a, b) => b.credibilityScore - a.credibilityScore);
      
      console.log(`✅ Evidence aggregation complete: ${evidence.length} items`);
      console.log(`   - High score (>=80): ${evidence.filter(e => e.credibilityScore >= 80).length}`);
      console.log(`   - Medium score (60-79): ${evidence.filter(e => e.credibilityScore >= 60 && e.credibilityScore < 80).length}`);
      console.log(`   - Low score (<60): ${evidence.filter(e => e.credibilityScore < 60).length}`);

      return evidence;
    }

    // ⚠️ NEW: Helper methods for better data extraction
    private extractUrl(result: any): string | null {
        return result.link || result.url || result.claimReview?.[0]?.url || null;
    }

    private extractPublisher(result: any): string {
        return result.source || 
               result.publisher || 
               result.claimReview?.[0]?.publisher?.name ||
               result.claimant ||
               'Unknown Source';
    }

    private extractQuote(result: any): string {
        const quote = result.snippet || 
                      result.description || 
                      result.text || 
                      result.quote ||
                      result.claimReview?.[0]?.title ||
                      '';
        
        // Truncate if too long
        return quote.length > 500 ? quote.substring(0, 500) + '...' : quote;
    }

    private normalizeUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Remove trailing slashes, www, and protocols for comparison
            return urlObj.host.replace(/^www\./, '') + urlObj.pathname.replace(/\/$/, '');
        } catch {
            return url.toLowerCase();
        }
    }

    private classifySource(result: any): string {
        const url = this.extractUrl(result)?.toLowerCase() || '';
        const source = this.extractPublisher(result).toLowerCase();

        if (url.includes('.gov') || source.includes('government')) return 'Government';
        if (url.includes('.edu') || source.includes('university')) return 'Academic';
        if (url.includes('factcheck') || url.includes('politifact') || url.includes('snopes')) return 'Fact-Checker';
        if (url.includes('reuters') || url.includes('apnews') || url.includes('bbc')) return 'News Agency';
        if (url.includes('news') || source.includes('news')) return 'News';
        
        return 'General';
    }

    private calculateEvidenceScore(result: any): number {
        let score = 50; // Base score

        // Check for fact-check rating
        if (result.claimReview && result.claimReview[0]) {
            const rating = result.claimReview[0].reviewRating;
            if (rating) {
                const textRating = (rating.textualRating || '').toLowerCase();
                if (textRating.includes('true')) score = 90;
                else if (textRating.includes('mostly true')) score = 75;
                else if (textRating.includes('mixed')) score = 50;
                else if (textRating.includes('mostly false')) score = 25;
                else if (textRating.includes('false')) score = 10;
            }
        }

        // Boost for authoritative sources
        if (this.isAuthoritativeSource(result)) {
            score += 25;
        }

        const url = this.extractUrl(result)?.toLowerCase() || '';
        
        // Additional boosts
        if (url.includes('factcheck') || url.includes('politifact')) score += 20;
        if (url.includes('.gov') || url.includes('.edu')) score += 15;
        if (url.includes('reuters') || url.includes('apnews') || url.includes('bbc')) score += 15;

        return Math.min(100, Math.max(10, score));
    }

    private determineEvidenceType(result: any): 'claim' | 'news' | 'search_result' {
        if (result.claimReview) return 'claim';
        
        const url = this.extractUrl(result)?.toLowerCase() || '';
        const source = this.extractPublisher(result).toLowerCase();
        
        if (url.includes('factcheck') || url.includes('politifact') || url.includes('snopes')) {
            return 'claim';
        }
        
        if (url.includes('news') || source.includes('news') || 
            url.includes('reuters') || url.includes('apnews') || url.includes('bbc')) {
            return 'news';
        }
        
        return 'search_result';
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    getSimpleQueries(pipelineResult: PipelineResult): string[] {
        return pipelineResult.executionPlan.immediate
            .map(query => this.buildSearchString(query))
            .slice(0, 5);
    }
}
