// src/services/analysis/AdvancedQueryPipeline.ts
// MASTER ORCHESTRATOR FOR MULTI-STAGE QUERY PROCESSING
import { AdvancedTextAnalyzer, DeepTextAnalysis } from '@/services/analysis/AdvancedTextAnalyzer';
import { SemanticKeywordExtractor, SemanticExtraction } from '@/services/analysis/SemanticKeywordExtractor';
import { IntelligentQuerySynthesizer, QuerySynthesisResult, FactCheckQuery } from '@/services/analysis/IntelligentQuerySynthesizer';
import { generateSHA256 } from '@/utils/hashUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export interface QueryValidationResult {
    queryId: string;
    isValid: boolean;
    validationScore: number; // 0-100
    issues: string[];
    suggestions: string[];
    shouldExecute: boolean;
}

export interface RankedQuery extends FactCheckQuery {
    rank: number;
    compositeScore: number; // Combined priority + relevance + validation
    executionOrder: number;
}

export interface PipelineResult {
    textAnalysis: DeepTextAnalysis;
    semanticExtraction: SemanticExtraction;
    querySynthesis: QuerySynthesisResult;
    validatedQueries: QueryValidationResult[];
    rankedQueries: RankedQuery[];
    executionPlan: {
        immediate: RankedQuery[]; // Execute now
        followUp: RankedQuery[]; // Execute after immediate
        deepDive: RankedQuery[]; // Execute if needed
    };
    cacheKey: string;
    metadata: {
        pipelineVersion: string;
        totalProcessingTime: number;
        stagesCompleted: string[];
        timestamp: string;
    };
}

export interface QueryEffectivenessMetrics {
    queryId: string;
    resultsReturned: number;
    relevantResults: number;
    authoritativeSources: number;
    executionTime: number;
    userFeedback?: 'helpful' | 'not-helpful';
}

// ============================================================================
// SERVICE CLASS
// ============================================================================
export class AdvancedQueryPipeline {
    private static instance: AdvancedQueryPipeline;
    private analyzer: AdvancedTextAnalyzer;
    private extractor: SemanticKeywordExtractor;
    private synthesizer: IntelligentQuerySynthesizer;

    // Query effectiveness tracking (in-memory for now)
    private effectivenessHistory: Map<string, QueryEffectivenessMetrics[]> = new Map();
    private readonly PIPELINE_VERSION = '1.0.0';

    private constructor() {
        this.analyzer = AdvancedTextAnalyzer.getInstance();
        this.extractor = SemanticKeywordExtractor.getInstance();
        this.synthesizer = IntelligentQuerySynthesizer.getInstance();
    }

    static getInstance(): AdvancedQueryPipeline {
        if (!AdvancedQueryPipeline.instance) {
            AdvancedQueryPipeline.instance = new AdvancedQueryPipeline();
        }
        return AdvancedQueryPipeline.instance;
    }

    /**

    MAIN PIPELINE METHOD - Executes all 4 stages
    */
    async processText(text: string): Promise<PipelineResult> {
        console.log('🚀 Starting Advanced Query Pipeline...');
        const pipelineStart = Date.now();
        const stagesCompleted: string[] = [];

        try {
            // ========== STAGE 1: DEEP TEXT ANALYSIS ==========
            console.log('📊 Stage 1: Deep Text Analysis');
            const textAnalysis = await this.analyzer.analyzeText(text);
            stagesCompleted.push('deep-text-analysis');

            // ========== STAGE 2: SEMANTIC KEYWORD EXTRACTION ==========
            console.log('🔑 Stage 2: Semantic Keyword Extraction');
            const semanticExtraction = await this.extractor.extractKeywords(textAnalysis);
            stagesCompleted.push('semantic-extraction');

            // ========== STAGE 3: QUERY SYNTHESIS ==========
            console.log('🔍 Stage 3: Intelligent Query Synthesis');
            const querySynthesis = await this.synthesizer.synthesizeQueries(
                textAnalysis,
                semanticExtraction
            );
            stagesCompleted.push('query-synthesis');

            // ========== STAGE 4: QUERY VALIDATION & RANKING ==========
            console.log('✅ Stage 4: Query Validation & Ranking');
            const allQueries = this.collectAllQueries(querySynthesis);
            const validatedQueries = this.validateQueries(allQueries, textAnalysis);
            const rankedQueries = this.rankQueries(allQueries, validatedQueries, querySynthesis);
            const executionPlan = this.buildExecutionPlan(rankedQueries, querySynthesis);
            stagesCompleted.push('validation-ranking');

            // Generate cache key for future optimizations
            const cacheKey = await generateSHA256(`pipeline::${text}`);
            const totalProcessingTime = Date.now() - pipelineStart;

            const result: PipelineResult = {
                textAnalysis,
                semanticExtraction,
                querySynthesis,
                validatedQueries,
                rankedQueries,
                executionPlan,
                cacheKey,
                metadata: {
                    pipelineVersion: this.PIPELINE_VERSION,
                    totalProcessingTime,
                    stagesCompleted,
                    timestamp: new Date().toISOString()
                }
            };

            console.log(`✅ Pipeline completed in ${totalProcessingTime}ms`);
            console.log(`   - Stages: ${stagesCompleted.join(' → ')}`);
            console.log(`   - Queries generated: ${allQueries.length}`);
            console.log(`   - Validated queries: ${validatedQueries.filter(v => v.shouldExecute).length}`);
            console.log(`   - Immediate execution: ${executionPlan.immediate.length} queries`);

            return result;

        } catch (error) {
            console.error('❌ Pipeline failed:', error);
            throw new Error(`Advanced Query Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**

    Collect all queries from synthesis result
    */
    private collectAllQueries(synthesis: QuerySynthesisResult): FactCheckQuery[] {
        return [
            ...synthesis.primaryQueries,
            ...synthesis.crossReferenceQueries,
            ...synthesis.sourceTargetedQueries.factCheckSites,
            ...synthesis.sourceTargetedQueries.newsAgencies,
            ...synthesis.sourceTargetedQueries.academicSources,
            ...synthesis.sourceTargetedQueries.governmentSources
        ];
    }

    /**

    Validate queries for quality and executability
    */
    private validateQueries(
        queries: FactCheckQuery[],
        textAnalysis: DeepTextAnalysis
    ): QueryValidationResult[] {
        return queries.map(query => {
            const issues: string[] = [];
            const suggestions: string[] = [];
            let validationScore = 100;

            // Check 1: Query length (optimal 5-15 words)
            const wordCount = query.queryText.split(/\s+/).length;
            if (wordCount < 3) {
                issues.push('Query too short - may be too vague');
                validationScore -= 20;
                suggestions.push('Add more specific terms or entities');
            } else if (wordCount > 20) {
                issues.push('Query too long - may be over-specified');
                validationScore -= 15;
                suggestions.push('Simplify query to core concepts');
            }

            // Check 2: Contains at least one entity or keyword
            const hasEntity = textAnalysis.namedEntities.some(entity =>
                query.queryText.toLowerCase().includes(entity.text.toLowerCase())
            );
            if (!hasEntity && query.priority > 7) {
                issues.push('High-priority query missing key entities');
                validationScore -= 10;
                suggestions.push('Include primary named entities');
            }

            // Check 3: Appropriate use of search operators
            const operatorCount = query.searchOperators.length;
            if (operatorCount === 0 && query.queryType === 'source-specific') {
                issues.push('Source-specific query missing site operator');
                validationScore -= 25;
                suggestions.push('Add site: operator to target specific domains');
            } else if (operatorCount > 5) {
                issues.push('Too many operators - may over-constrain results');
                validationScore -= 10;
                suggestions.push('Reduce to 2-3 most important operators');
            }

            // Check 4: Temporal queries should have date operators
            if (query.queryType === 'temporal-context' && textAnalysis.temporalContext.hasDateReference) {
                const hasDateOperator = query.searchOperators.some(op =>
                    op.type === 'before' || op.type === 'after'
                );
                if (!hasDateOperator) {
                    issues.push('Temporal query missing date operators');
                    validationScore -= 15;
                    suggestions.push('Add after: or before: operators with specific dates');
                }
            }

            // Check 5: Duplicate detection
            const duplicateCheck = this.checkForDuplicates(query, queries);
            if (duplicateCheck.isDuplicate) {
                issues.push(`Similar to query ${duplicateCheck.similarTo}`);
                validationScore -= 20;
                suggestions.push('Consider merging with similar query');
            }

            // Check 6: Historical effectiveness (if available)
            const effectiveness = this.getQueryEffectiveness(query.queryText);
            if (effectiveness && effectiveness.avgRelevance < 30) {
                issues.push('Similar queries historically returned poor results');
                validationScore -= 15;
                suggestions.push('Try alternative phrasing');
            }

            const shouldExecute = validationScore >= 50 && issues.length < 3;
            return {
                queryId: query.queryId,
                isValid: validationScore >= 60,
                validationScore: Math.max(0, validationScore),
                issues,
                suggestions,
                shouldExecute
            };
        });
    }

    /**

    Check for duplicate or highly similar queries
    */
    private checkForDuplicates(
        query: FactCheckQuery,
        allQueries: FactCheckQuery[]
    ): { isDuplicate: boolean; similarTo?: string } {
        const queryWords = new Set(query.queryText.toLowerCase().split(/\s+/));
        for (const other of allQueries) {
            if (other.queryId === query.queryId) continue;
            const otherWords = new Set(other.queryText.toLowerCase().split(/\s+/));
            const intersection = new Set([...queryWords].filter(w => otherWords.has(w)));
            const similarity = intersection.size / Math.max(queryWords.size, otherWords.size);
            if (similarity > 0.8) {
                return { isDuplicate: true, similarTo: other.queryId };
            }
        }
        return { isDuplicate: false };
    }

    /**

    Get historical effectiveness of similar queries
    */
    private getQueryEffectiveness(queryText: string): {
        avgRelevance: number;
        totalExecutions: number;
    } | null {
        const similarQueries = Array.from(this.effectivenessHistory.values())
            .flat()
            .filter(metric => {
                const similarity = this.calculateTextSimilarity(queryText, metric.queryId);
                return similarity > 0.7;
            });
        if (similarQueries.length === 0) return null;
        const avgRelevance = similarQueries.reduce((sum, m) =>
            sum + (m.relevantResults / Math.max(m.resultsReturned, 1)) * 100, 0
        ) / similarQueries.length;
        return {
            avgRelevance,
            totalExecutions: similarQueries.length
        };
    }

    /**

    Simple text similarity calculation
    */
    private calculateTextSimilarity(text1: string, text2: string): number {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        return intersection.size / Math.max(words1.size, words2.size);
    }

    /**

    Rank queries based on composite scoring
    */
    private rankQueries(
        queries: FactCheckQuery[],
        validations: QueryValidationResult[],
        synthesis: QuerySynthesisResult
    ): RankedQuery[] {
        const rankedQueries: RankedQuery[] = queries.map((query, index) => {
            const validation = validations.find(v => v.queryId === query.queryId);
            // Composite score calculation (0-100)
            const priorityScore = (query.priority / 10) * 40; // 40% weight
            const relevanceScore = (query.estimatedRelevance / 100) * 30; // 30% weight
            const validationScore = ((validation?.validationScore || 50) / 100) * 30; // 30% weight
            const compositeScore = priorityScore + relevanceScore + validationScore;
            return {
                ...query,
                rank: 0, // Will be assigned after sorting
                compositeScore,
                executionOrder: index
            };
        });

        // Sort by composite score (descending)
        rankedQueries.sort((a, b) => b.compositeScore - a.compositeScore);

        // Assign ranks
        rankedQueries.forEach((query, index) => {
            query.rank = index + 1;
        });
        return rankedQueries;
    }

    /**

    Build intelligent execution plan
    */
    private buildExecutionPlan(
        rankedQueries: RankedQuery[],
        synthesis: QuerySynthesisResult
    ): {
        immediate: RankedQuery[];
        followUp: RankedQuery[];
        deepDive: RankedQuery[];
    } {
        // Phase 1: Immediate execution (top-ranked queries)
        const immediate = rankedQueries
            .filter(q => q.compositeScore >= 75)
            .slice(0, 5);
        // Phase 2: Follow-up execution (medium priority)
        const followUp = rankedQueries
            .filter(q => q.compositeScore >= 50 && q.compositeScore < 75)
            .slice(0, 7);
        // Phase 3: Deep dive (lower priority, but may be useful)
        const deepDive = rankedQueries
            .filter(q => q.compositeScore < 50)
            .slice(0, 5);
        return { immediate, followUp, deepDive };
    }

    /**

    Track query effectiveness for future optimization
    */
    recordQueryEffectiveness(metrics: QueryEffectivenessMetrics): void {
        const queryKey = metrics.queryId.split('-')[0]; // e.g., "primary", "cross-ref"
        if (!this.effectivenessHistory.has(queryKey)) {
            this.effectivenessHistory.set(queryKey, []);
        }
        this.effectivenessHistory.get(queryKey)!.push(metrics);
        // Keep only last 100 metrics per query type
        const history = this.effectivenessHistory.get(queryKey)!;
        if (history.length > 100) {
            history.shift();
        }
        console.log(`📊 Recorded effectiveness for ${metrics.queryId}: ${metrics.relevantResults}/${metrics.resultsReturned} relevant`);
    }

    /**

    Get optimization suggestions based on effectiveness history
    */
    getOptimizationSuggestions(): {
        underperformingQueryTypes: string[];
        recommendedAdjustments: string[];
    } {
        const underperforming: string[] = [];
        const recommendations: string[] = [];
        this.effectivenessHistory.forEach((metrics, queryType) => {
            const avgEffectiveness = metrics.reduce((sum, m) =>
                sum + (m.relevantResults / Math.max(m.resultsReturned, 1)), 0
            ) / metrics.length;
            if (avgEffectiveness < 0.3) {
                underperforming.push(queryType);
                if (queryType === 'primary') {
                    recommendations.push('Consider using more specific primary queries with exact phrases');
                } else if (queryType === 'cross-ref') {
                    recommendations.push('Cross-reference queries may need better source targeting');
                } else if (queryType.includes('source')) {
                    recommendations.push(`${queryType} queries may benefit from refined site operators`);
                }
            }
        });
        return {
            underperformingQueryTypes: underperforming,
            recommendedAdjustments: recommendations
        };
    }

    /**

    Get statistics about pipeline performance
    */
    getPipelineStats(): {
        totalQueriesGenerated: number;
        avgValidationScore: number;
        avgProcessingTime: number;
        mostEffectiveQueryType: string;
    } {
        let totalMetrics = 0;
        let totalRelevance = 0;
        let bestType = 'unknown';
        let bestRelevance = 0;
        this.effectivenessHistory.forEach((metrics, queryType) => {
            const typeRelevance = metrics.reduce((sum, m) =>
                sum + (m.relevantResults / Math.max(m.resultsReturned, 1)), 0
            ) / metrics.length;
            totalMetrics += metrics.length;
            totalRelevance += typeRelevance;
            if (typeRelevance > bestRelevance) {
                bestRelevance = typeRelevance;
                bestType = queryType;
            }
        });
        return {
            totalQueriesGenerated: totalMetrics,
            avgValidationScore: 0, // Would need to track this separately
            avgProcessingTime: 0, // Would need to track this separately
            mostEffectiveQueryType: bestType
        };
    }
}
