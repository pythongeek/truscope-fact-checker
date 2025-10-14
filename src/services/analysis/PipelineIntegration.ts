// src/services/analysis/PipelineIntegration.ts
// FIXED VERSION - Resolves type errors and enhances evidence data with more detail.

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
        console.log(`     - Queries executed: ${totalQueriesExecuted}`);
        console.log(`     - Results returned: ${totalResultsReturned}`);
        console.log(`     - Evidence items: ${aggregatedEvidence.length}`);

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
                        resultsMap.set(query.queryId, results || []);

                        const relevantCount = results ? results.filter((r: any) => this.isRelevantResult(r, query)).length : 0;
                        const authoritativeCount = results ? results.filter((r: any) => this.isAuthoritativeSource(r)).length : 0;

                        this.pipeline.recordQueryEffectiveness({
                            queryId: query.queryId,
                            resultsReturned: results?.length || 0,
                            relevantResults: relevantCount,
                            authoritativeSources: authoritativeCount,
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
        const nonSiteOperators = query.searchOperators.filter(op => op.type !== 'site');
        
        nonSiteOperators.forEach(op => {
            searchString += ` ${op.type}:"${op.value}"`;
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
            if (expectedTypes.includes('fact-check')) {
                const report = await this.factCheckApi.searchClaims(searchString, maxResults);
                const evidence = report ? report.evidence : [];
                console.log(`🔍 Fact-check search returned ${evidence.length} results`);
                return evidence;
            } else {
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
        const title = result.title || result.text || '';
        const snippet = result.snippet || result.description || result.quote || '';
        const resultText = `${title} ${snippet}`.toLowerCase();

        if (!resultText.trim()) return false;

        const queryTerms = query.queryText.toLowerCase().split(/\s+/).filter(t => t.length > 3 && !['site:', 'intitle:', 'inurl:'].some(op => t.includes(op)));
        if (queryTerms.length === 0) return true;

        const matchCount = queryTerms.filter(term => resultText.includes(term)).length;
        return matchCount >= Math.max(1, Math.ceil(queryTerms.length * 0.3));
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
        return authoritativeDomains.some(domain => url.includes(domain) || source.includes(domain));
    }

    private aggregateEvidence(
        searchResults: {
            immediate: Map<string, any[]>;
            followUp: Map<string, any[]>;
            deepDive: Map<string, any[]>;
        },
        pipelineResult: PipelineResult
    ): EvidenceItem[] {
        console.log('🔄 Starting evidence aggregation...');
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

        const uniqueResults = new Map<string, any>();
        allResults.forEach(result => {
            const url = this.extractUrl(result);
            if (url) {
                const normalizedUrl = this.normalizeUrl(url);
                if (!uniqueResults.has(normalizedUrl)) {
                    uniqueResults.set(normalizedUrl, result);
                }
            } else {
                const titleKey = `no-url-${result.title || result.text || Math.random()}`;
                if (!uniqueResults.has(titleKey)) {
                    uniqueResults.set(titleKey, result);
                }
            }
        });

        console.log(`📊 Unique results after deduplication: ${uniqueResults.size}`);

        const evidence: EvidenceItem[] = Array.from(uniqueResults.values()).map((result, index) => {
            // FIX: Ensure URL is always a string to match the EvidenceItem type.
            const url = this.extractUrl(result) ?? '';
            const publisher = this.extractPublisher(result);
            const quote = this.extractQuote(result);
            const score = this.calculateEvidenceScore(result);
            const type = this.determineEvidenceType(result);
            const title = result.title || quote.substring(0, 80);
            const publicationDate = this.extractPublicationDate(result);
            const author = this.extractAuthor(result);

            return {
                id: `evidence-${index + 1}`,
                publisher,
                url,
                quote,
                credibilityScore: score,
                relevanceScore: score,
                score,
                type,
                title,
                snippet: quote,
                publicationDate, // Added for more detail
                author, // Added for more detail
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

        evidence.sort((a, b) => b.credibilityScore - a.credibilityScore);
        console.log(`✅ Evidence aggregation complete: ${evidence.length} items`);
        return evidence;
    }

    private extractUrl(result: any): string | null {
        return result.link || result.url || result.claimReview?.[0]?.url || null;
    }

    private extractPublisher(result: any): string {
        return result.source || result.publisher || result.claimReview?.[0]?.publisher?.name || result.claimant || 'Unknown Source';
    }

    private extractQuote(result: any): string {
        const quote = result.snippet || result.description || result.text || result.quote || result.claimReview?.[0]?.title || '';
        return quote.length > 500 ? quote.substring(0, 500) + '...' : quote;
    }

    // NEW: Helper to extract publication date
    private extractPublicationDate(result: any): string | undefined {
        const dateString = result.date || result.publication_date || result.claimReview?.[0]?.reviewDate || result.published;
        if (dateString) {
            try {
                return new Date(dateString).toISOString();
            } catch (e) {
                return dateString; // Return original string if it's not a valid date
            }
        }
        return undefined;
    }

    // NEW: Helper to extract author
    private extractAuthor(result: any): string | null {
        return result.author || result.claimant || null;
    }

    private normalizeUrl(url: string): string {
        try {
            const urlObj = new URL(url);
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
        if (['factcheck.org', 'politifact.com', 'snopes.com'].some(d => url.includes(d))) return 'Fact-Checker';
        if (['reuters.com', 'apnews.com', 'bbc.com'].some(d => url.includes(d))) return 'News Agency';
        if (url.includes('news') || source.includes('news')) return 'News';
        return 'General';
    }

    private calculateEvidenceScore(result: any): number {
        let score = 50; // Base score
        if (result.claimReview && result.claimReview[0]?.reviewRating?.textualRating) {
            const textRating = result.claimReview[0].reviewRating.textualRating.toLowerCase();
            if (textRating.includes('true')) score = 90;
            else if (textRating.includes('mostly true')) score = 75;
            else if (textRating.includes('mixed')) score = 50;
            else if (textRating.includes('mostly false')) score = 25;
            else if (textRating.includes('false')) score = 10;
        }
        if (this.isAuthoritativeSource(result)) score += 25;
        return Math.min(100, Math.max(10, score));
    }

    private determineEvidenceType(result: any): 'claim' | 'news' | 'search_result' {
        if (result.claimReview) return 'claim';
        const url = this.extractUrl(result)?.toLowerCase() || '';
        const source = this.extractPublisher(result).toLowerCase();
        if (['factcheck.org', 'politifact.com', 'snopes.com'].some(d => url.includes(d))) return 'claim';
        if (url.includes('news') || source.includes('news') || ['reuters.com', 'apnews.com', 'bbc.com'].some(d => url.includes(d))) return 'news';
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
        return pipelineResult.executionPlan.immediate.map(query => this.buildSearchString(query)).slice(0, 5);
    }
}
