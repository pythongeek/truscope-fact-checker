// src/services/analysis/PipelineIntegration.ts
// INTEGRATION LAYER: Connects Advanced Pipeline to Existing Fact-Check System
import { AdvancedQueryPipeline, PipelineResult, RankedQuery } from '@/services/analysis/AdvancedQueryPipeline';
import { SerpApiService } from '@/services/serpApiService';
import { GoogleFactCheckService } from '@/services/googleFactCheckService';
import { WebSearchService } from '@/services/webSearchService';
import { FactCheckReport, EvidenceItem } from '@/types/factCheck';

export interface EnhancedSearchResult {
    pipelineResult: PipelineResult;
    searchResults: {
        immediate: Map<string, any[]>; // Query ID -> Results
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

    /**

    MAIN INTEGRATION METHOD
    Processes text through pipeline and executes queries
    */
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

        // ========== STEP 1: Run Advanced Query Pipeline ==========
        const pipelineResult = await this.pipeline.processText(text);

        // ========== STEP 2: Execute Queries by Phase ==========
        const searchResults = {
            immediate: new Map<string, any[]>(),
            followUp: new Map<string, any[]>(),
            deepDive: new Map<string, any[]>()
        };

        const phaseTimings = {
            phase1: 0,
            phase2: 0,
            phase3: 0
        };

        // Phase 1: Immediate queries (always executed)
        const phase1Start = Date.now();
        await this.executeQueries(
            pipelineResult.executionPlan.immediate,
            searchResults.immediate,
            maxResultsPerQuery
        );
        phaseTimings.phase1 = Date.now() - phase1Start;
        console.log(`✅ Phase 1 completed in ${phaseTimings.phase1}ms`);

        // Phase 2: Follow-up queries (optional)
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

        // Phase 3: Deep dive queries (optional, for complex claims)
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

        // ========== STEP 3: Aggregate and Deduplicate Results ==========
        const aggregatedEvidence = this.aggregateEvidence(searchResults, pipelineResult);

        // ========== STEP 4: Calculate Metrics ==========
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
        console.log(`   - Queries executed: ${totalQueriesExecuted}`);
        console.log(`   - Results returned: ${totalResultsReturned}`);
        console.log(`   - Evidence items: ${aggregatedEvidence.length}`);

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

    /**

    Execute a batch of queries
    */
    private async executeQueries(
        queries: RankedQuery[],
        resultsMap: Map<string, any[]>,
        maxResults: number
    ): Promise<void> {
        if (queries.length === 0) return;

        // Execute queries in parallel (but limit concurrency)
        const concurrencyLimit = 3;
        const batches = this.chunkArray(queries, concurrencyLimit);

        for (const batch of batches) {
            await Promise.all(
                batch.map(async (query) => {
                    try {
                        const searchString = this.buildSearchString(query);
                        const results = await this.executeSearchQuery(searchString, query, maxResults);
                        resultsMap.set(query.queryId, results);

                        // Record effectiveness for pipeline optimization
                        this.pipeline.recordQueryEffectiveness({
                            queryId: query.queryId,
                            resultsReturned: results.length,
                            relevantResults: results.filter((r: any) => this.isRelevantResult(r, query)).length,
                            authoritativeSources: results.filter((r: any) => this.isAuthoritativeSource(r)).length,
                            executionTime: 0 // Would need to track actual execution time
                        });

                    } catch (error) {
                        console.error(`❌ Query ${query.queryId} failed:`, error);
                        resultsMap.set(query.queryId, []);
                    }
                })
            );
        }
    }

    /**

    Build search string from query
    */
    private buildSearchString(query: RankedQuery): string {
        let searchString = query.queryText;
        query.searchOperators.forEach(op => {
            switch (op.type) {
                case 'site':
                    searchString += ` site:${op.value}`;
                    break;
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
                case 'exact-phrase':
                    // Already handled in queryText with quotes
                    break;
            }
        });
        return searchString.trim();
    }

    /**

    Execute actual search query based on expected source types
    */
    private async executeSearchQuery(
        searchString: string,
        query: RankedQuery,
        maxResults: number
    ): Promise<any[]> {
        const expectedTypes = query.expectedSourceTypes;

        // Route to appropriate search service based on expected source types
        if (expectedTypes.includes('fact-check')) {
            // Use fact-check specific search
            const factCheckResults = await this.factCheckApi.searchClaims(searchString, maxResults);
            return factCheckResults;
        } else if (expectedTypes.includes('news') || expectedTypes.includes('academic') || expectedTypes.includes('government')) {
            // Use general SERP search
            const serpResults = await this.serpApi.search(searchString, maxResults);
            return serpResults.results || [];
        } else {
            // Default to web search service
            const webResults = await this.webSearch.search(searchString, {
                maxSerpResults: maxResults
            });
            return webResults.serp.results || [];
        }
    }

    /**

    Check if result is relevant to the query
    */
    private isRelevantResult(result: any, query: RankedQuery): boolean {
        const resultText = `${result.title || ''} ${result.snippet || result.description || ''}`.toLowerCase();
        // Check if result contains key terms from the query
        const queryTerms = query.queryText.toLowerCase().split(/\s+/).filter(t => t.length > 3);
        const matchCount = queryTerms.filter(term => resultText.includes(term)).length;
        return matchCount >= Math.ceil(queryTerms.length * 0.4); // At least 40% of terms match
    }

    /**

    Check if source is authoritative
    */
    private isAuthoritativeSource(result: any): boolean {
        const url = (result.link || result.url || '').toLowerCase();
        const source = (result.source || '').toLowerCase();
        const authoritativeDomains = [
            'factcheck.org', 'politifact.com', 'snopes.com', 'reuters.com', 'apnews.com',
            'bbc.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com',
            '.gov', '.edu', 'who.int', 'cdc.gov', 'scholar.google'
        ];
        return authoritativeDomains.some(domain =>
            url.includes(domain) || source.includes(domain)
        );
    }

    /**

    Aggregate evidence from all search results
    */
    private aggregateEvidence(
        searchResults: {
            immediate: Map<string, any[]>;
            followUp: Map<string, any[]>;
            deepDive: Map<string, any[]>;
        },
        pipelineResult: PipelineResult
    ): EvidenceItem[] {
        const allResults = [
            ...Array.from(searchResults.immediate.values()),
            ...Array.from(searchResults.followUp.values()),
            ...Array.from(searchResults.deepDive.values())
        ].flat();

        // Deduplicate by URL
        const uniqueResults = new Map<string, any>();
        allResults.forEach(result => {
            const url = result.link || result.url;
            if (url && !uniqueResults.has(url)) {
                uniqueResults.set(url, result);
            }
        });

        // Convert to Evidence Items
        const evidence: EvidenceItem[] = Array.from(uniqueResults.values()).map((result, index) => ({
            id: `evidence-${index + 1}`,
            publisher: result.source || result.publisher || 'Unknown',
            url: result.link || result.url || null,
            quote: result.snippet || result.description || result.text || '',
            score: this.calculateEvidenceScore(result),
            type: this.determineEvidenceType(result),
            source: {
                name: result.source || 'Unknown',
                url: result.link || result.url,
                credibility: {
                    rating: 'Not Rated',
                    classification: 'Unknown',
                    warnings: [],
                }
            }
        }));

        // Sort by score (descending)
        evidence.sort((a, b) => b.score - a.score);
        return evidence;
    }

    /**

    Calculate evidence credibility score
    */
    private calculateEvidenceScore(result: any): number {
        let score = 50; // Base score
        // Boost for authoritative sources
        if (this.isAuthoritativeSource(result)) {
            score += 30;
        }
        // Boost for fact-checking sites
        const url = (result.link || result.url || '').toLowerCase();
        if (url.includes('factcheck') || url.includes('politifact') || url.includes('snopes')) {
            score += 20;
        }
        // Boost for government/academic sources
        if (url.includes('.gov') || url.includes('.edu')) {
            score += 15;
        }
        // Cap at 100
        return Math.min(100, score);
    }

    /**

    Determine evidence type
    */
    private determineEvidenceType(result: any): 'claim' | 'news' | 'search_result' {
        const url = (result.link || result.url || '').toLowerCase();
        if (url.includes('factcheck') || url.includes('politifact') || url.includes('snopes')) {
            return 'claim';
        } else if (url.includes('news') || url.includes('reuters') || url.includes('apnews')) {
            return 'news';
        } else {
            return 'search_result';
        }
    }

    /**

    Utility: Chunk array for batch processing
    */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**

    Get simple query strings for backward compatibility
    */
    getSimpleQueries(pipelineResult: PipelineResult): string[] {
        return pipelineResult.executionPlan.immediate
            .map(query => this.buildSearchString(query))
            .slice(0, 5); // Return top 5 for compatibility
    }
}
