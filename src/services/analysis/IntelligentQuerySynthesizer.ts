// src/services/analysis/IntelligentQuerySynthesizer.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiModel } from '../apiKeyService';
import { parseAIJsonResponse } from '../../utils/jsonParser';
import { DeepTextAnalysis, AtomicClaim } from './AdvancedTextAnalyzer';
import { SemanticExtraction } from './SemanticKeywordExtractor';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FactCheckQuery {
    queryId: string;
    queryText: string;
    queryType: 'primary-verification' | 'cross-reference' | 'temporal-context' | 'source-specific' | 'entity-verification';
    targetClaims: string[];
    searchOperators: SearchOperator[];
    expectedSourceTypes: ('fact-check' | 'news' | 'academic' | 'government' | 'social')[];
    priority: number;
    estimatedRelevance: number;
    alternatives: string[];
}

export interface SearchOperator {
    type: 'site' | 'intitle' | 'inurl' | 'filetype' | 'before' | 'after' | 'OR' | 'exact-phrase';
    value: string;
    purpose: string;
}

export interface TemporalQuery {
    baseQuery: string;
    dateRange?: { start: string; end: string };
    temporalModifiers: string[];
    recencyFocus: 'breaking' | 'recent' | 'historical' | 'any';
}

export interface QuerySynthesisResult {
    primaryQueries: FactCheckQuery[];
    crossReferenceQueries: FactCheckQuery[];
    temporalQueries: TemporalQuery[];
    sourceTargetedQueries: {
        factCheckSites: FactCheckQuery[];
        newsAgencies: FactCheckQuery[];
        academicSources: FactCheckQuery[];
        governmentSources: FactCheckQuery[];
    };
    queryExecutionPlan: {
        phase1: string[];
        phase2: string[];
        phase3: string[];
    };
    metadata: {
        totalQueries: number;
        estimatedSearchTime: number;
        processingTimestamp: string;
    };
}

// ============================================================================
// SCHEMA DEFINITIONS - Fixed with proper typing
// ============================================================================

const searchOperatorSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        type: {
            type: SchemaType.STRING,
            enum: ['site', 'intitle', 'inurl', 'filetype', 'before', 'after', 'OR', 'exact-phrase']
        },
        value: { type: SchemaType.STRING },
        purpose: { type: SchemaType.STRING }
    },
    required: ['type', 'value', 'purpose']
};

const factCheckQuerySchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        queryId: { type: SchemaType.STRING },
        queryText: { type: SchemaType.STRING },
        queryType: {
            type: SchemaType.STRING,
            enum: ['primary-verification', 'cross-reference', 'temporal-context', 'source-specific', 'entity-verification']
        },
        targetClaims: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        searchOperators: {
            type: SchemaType.ARRAY,
            items: searchOperatorSchema
        },
        expectedSourceTypes: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.STRING,
                enum: ['fact-check', 'news', 'academic', 'government', 'social']
            }
        },
        priority: { type: SchemaType.INTEGER },
        estimatedRelevance: { type: SchemaType.INTEGER },
        alternatives: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        }
    },
    required: ['queryId', 'queryText', 'queryType', 'targetClaims', 'searchOperators', 'expectedSourceTypes', 'priority', 'estimatedRelevance', 'alternatives']
};

const temporalQuerySchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        baseQuery: { type: SchemaType.STRING },
        dateRange: {
            type: SchemaType.OBJECT,
            nullable: true,
            properties: {
                start: { type: SchemaType.STRING },
                end: { type: SchemaType.STRING }
            },
            required: ['start', 'end']
        },
        temporalModifiers: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        recencyFocus: {
            type: SchemaType.STRING,
            enum: ['breaking', 'recent', 'historical', 'any']
        }
    },
    required: ['baseQuery', 'temporalModifiers', 'recencyFocus']
};

const querySynthesisSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        primaryQueries: {
            type: SchemaType.ARRAY,
            items: factCheckQuerySchema
        },
        crossReferenceQueries: {
            type: SchemaType.ARRAY,
            items: factCheckQuerySchema
        },
        temporalQueries: {
            type: SchemaType.ARRAY,
            items: temporalQuerySchema
        },
        sourceTargetedQueries: {
            type: SchemaType.OBJECT,
            properties: {
                factCheckSites: {
                    type: SchemaType.ARRAY,
                    items: factCheckQuerySchema
                },
                newsAgencies: {
                    type: SchemaType.ARRAY,
                    items: factCheckQuerySchema
                },
                academicSources: {
                    type: SchemaType.ARRAY,
                    items: factCheckQuerySchema
                },
                governmentSources: {
                    type: SchemaType.ARRAY,
                    items: factCheckQuerySchema
                }
            },
            required: ['factCheckSites', 'newsAgencies', 'academicSources', 'governmentSources']
        },
        queryExecutionPlan: {
            type: SchemaType.OBJECT,
            properties: {
                phase1: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                phase2: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                phase3: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                }
            },
            required: ['phase1', 'phase2', 'phase3']
        }
    },
    required: ['primaryQueries', 'crossReferenceQueries', 'temporalQueries', 'sourceTargetedQueries', 'queryExecutionPlan']
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class IntelligentQuerySynthesizer {
    private static instance: IntelligentQuerySynthesizer;
    private genAI: GoogleGenerativeAI;

    private readonly FACT_CHECK_SITES = [
        'factcheck.org',
        'politifact.com',
        'snopes.com',
        'reuters.com/fact-check',
        'apnews.com/hub/fact-checking',
        'fullfact.org',
        'factcheck.afp.com',
        'africacheck.org'
    ];

    private readonly NEWS_AGENCIES = [
        'reuters.com',
        'apnews.com',
        'bbc.com/news',
        'nytimes.com',
        'washingtonpost.com',
        'theguardian.com'
    ];

    private readonly ACADEMIC_DOMAINS = [
        'edu',
        'scholar.google.com',
        'arxiv.org',
        'pubmed.gov'
    ];

    private readonly GOVERNMENT_DOMAINS = [
        'gov',
        'europa.eu',
        'who.int',
        'cdc.gov'
    ];

    private constructor() {
        this.genAI = new GoogleGenerativeAI(getGeminiApiKey());
    }

    static getInstance(): IntelligentQuerySynthesizer {
        if (!IntelligentQuerySynthesizer.instance) {
            IntelligentQuerySynthesizer.instance = new IntelligentQuerySynthesizer();
        }
        return IntelligentQuerySynthesizer.instance;
    }

    /**
     * Main synthesis method - generates comprehensive query strategy
     */
    async synthesizeQueries(
        textAnalysis: DeepTextAnalysis,
        semanticExtraction: SemanticExtraction
    ): Promise<QuerySynthesisResult> {
        console.log('🔍 Starting intelligent query synthesis...');
        const startTime = Date.now();

        try {
            const prompt = this.buildSynthesisPrompt(textAnalysis, semanticExtraction);
            const model = this.genAI.getGenerativeModel({ model: getGeminiModel() });

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json",
                    responseSchema: querySynthesisSchema
                }
            });

            const responseText = result.response.text();
            const synthesis = parseAIJsonResponse(responseText);

            const allQueries = [
                ...synthesis.primaryQueries,
                ...synthesis.crossReferenceQueries,
                ...Object.values(synthesis.sourceTargetedQueries).flat()
            ];

            const enrichedSynthesis: QuerySynthesisResult = {
                ...synthesis,
                metadata: {
                    totalQueries: allQueries.length,
                    estimatedSearchTime: Math.ceil(allQueries.length * 2.5),
                    processingTimestamp: new Date().toISOString()
                }
            };

            const processingTime = Date.now() - startTime;
            console.log(`✅ Query synthesis completed in ${processingTime}ms`);
            console.log(`   - Total queries: ${enrichedSynthesis.metadata.totalQueries}`);
            console.log(`   - Primary queries: ${synthesis.primaryQueries.length}`);
            console.log(`   - Execution phases: ${Object.keys(synthesis.queryExecutionPlan).length}`);

            return enrichedSynthesis;

        } catch (error) {
            console.error('❌ Query synthesis failed:', error);
            return this.generateFallbackSynthesis(textAnalysis, semanticExtraction);
        }
    }

    /**
     * Build comprehensive synthesis prompt
     */
    private buildSynthesisPrompt(
        analysis: DeepTextAnalysis,
        extraction: SemanticExtraction
    ): string {
        return `You are an expert in information retrieval and fact-checking query optimization. Generate a comprehensive query strategy for verifying claims.

ORIGINAL TEXT:
"${analysis.originalText}"

ATOMIC CLAIMS TO VERIFY:
${JSON.stringify(analysis.atomicClaims, null, 2)}

SEMANTIC KEYWORDS:
High Priority: ${extraction.searchableKeywordGroups.highPriority.join(', ')}
Medium Priority: ${extraction.searchableKeywordGroups.mediumPriority.join(', ')}

PRIMARY ENTITIES:
${extraction.primaryKeywords.map(k => k.keyword).join(', ')}

TEMPORAL CONTEXT:
${JSON.stringify(analysis.temporalContext, null, 2)}

YOUR TASKS:

1. PRIMARY VERIFICATION QUERIES (3-5 queries)
   - One query per major atomic claim
   - Use exact phrases for specific claims
   - Include key entities and dates
   - Target fact-checking sites

2. CROSS-REFERENCE QUERIES (2-4 queries)
   - Verify context and relationships between claims
   - Check for contradictory information
   - Explore different angles

3. TEMPORAL QUERIES (1-3 queries)
   - Focus on time-specific verification
   - Use date operators when dates are mentioned
   - Check for updates or changes over time

4. SOURCE-TARGETED QUERIES (distribute 5-10 queries across categories)
   a) Fact-Check Sites: Queries optimized for fact-checking databases
   b) News Agencies: Queries for authoritative news sources
   c) Academic Sources: Queries for scholarly verification
   d) Government Sources: Queries for official data

5. QUERY EXECUTION PLAN
   Organize queries into 3 phases:
   - Phase 1 (Run immediately): 3-5 highest priority queries
   - Phase 2 (Run after Phase 1): 3-7 medium priority queries
   - Phase 3 (Run for deep analysis): 2-5 lower priority queries

CRITICAL INSTRUCTIONS:
- Generate queries that fact-checkers would actually use
- Consider how authoritative sources phrase these topics
- Use operators that narrow results to credible sources
- Avoid opinion-seeking queries; focus on factual verification
- Return ONLY valid JSON matching the exact schema provided

Begin query synthesis now.`;
    }

    /**
     * Fallback synthesis when AI fails
     */
    private generateFallbackSynthesis(
        analysis: DeepTextAnalysis,
        extraction: SemanticExtraction
    ): QuerySynthesisResult {
        console.warn('⚠️ Using fallback query synthesis');

        const highPriorityKeywords = extraction.searchableKeywordGroups.highPriority.slice(0, 5);

        const primaryQueries: FactCheckQuery[] = analysis.atomicClaims
            .slice(0, 3)
            .map((claim, index) => ({
                queryId: `primary-${index + 1}`,
                queryText: `${highPriorityKeywords.slice(0, 3).join(' ')} fact check`,
                queryType: 'primary-verification' as const,
                targetClaims: [claim.id],
                searchOperators: [{
                    type: 'site' as const,
                    value: this.FACT_CHECK_SITES.slice(0, 3).join(' OR '),
                    purpose: 'Target fact-checking sites'
                }],
                expectedSourceTypes: ['fact-check' as const],
                priority: 10 - index,
                estimatedRelevance: 80 - (index * 10),
                alternatives: []
            }));

        const factCheckQueries: FactCheckQuery[] = [{
            queryId: 'fact-check-1',
            queryText: `${highPriorityKeywords.join(' ')} site:${this.FACT_CHECK_SITES[0]}`,
            queryType: 'source-specific' as const,
            targetClaims: analysis.atomicClaims.map(c => c.id),
            searchOperators: [{
                type: 'site' as const,
                value: this.FACT_CHECK_SITES[0],
                purpose: 'Primary fact-check source'
            }],
            expectedSourceTypes: ['fact-check' as const],
            priority: 9,
            estimatedRelevance: 85,
            alternatives: []
        }];

        return {
            primaryQueries,
            crossReferenceQueries: [],
            temporalQueries: [],
            sourceTargetedQueries: {
                factCheckSites: factCheckQueries,
                newsAgencies: [],
                academicSources: [],
                governmentSources: []
            },
            queryExecutionPlan: {
                phase1: primaryQueries.map(q => q.queryId),
                phase2: factCheckQueries.map(q => q.queryId),
                phase3: []
            },
            metadata: {
                totalQueries: primaryQueries.length + factCheckQueries.length,
                estimatedSearchTime: (primaryQueries.length + factCheckQueries.length) * 2.5,
                processingTimestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Helper: Convert query to actual search string
     */
    buildSearchString(query: FactCheckQuery): string {
        let searchString = query.queryText;

        query.searchOperators.forEach(op => {
            switch (op.type) {
                case 'site':
                    searchString += ` site:${op.value}`;
                    break;
                case 'intitle':
                    searchString += ` intitle:${op.value}`;
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
                    searchString = searchString.replace(op.value, `"${op.value}"`);
                    break;
            }
        });

        return searchString.trim();
    }
}
