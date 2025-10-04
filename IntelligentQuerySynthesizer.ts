// src/services/analysis/IntelligentQuerySynthesizer.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
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
targetClaims: string[]; // Claim IDs this query verifies
searchOperators: SearchOperator[];
expectedSourceTypes: ('fact-check' | 'news' | 'academic' | 'government' | 'social')[];
priority: number; // 1-10
estimatedRelevance: number; // 0-100
alternatives: string[]; // Alternative phrasings
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
phase1: string[]; // Query IDs to run first
phase2: string[]; // Query IDs to run after initial results
phase3: string[]; // Query IDs for deep verification
};
metadata: {
totalQueries: number;
estimatedSearchTime: number; // seconds
processingTimestamp: string;
};
}
// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================
const searchOperatorSchema = {
type: 'object',
properties: {
type: {
type: 'string',
enum: ['site', 'intitle', 'inurl', 'filetype', 'before', 'after', 'OR', 'exact-phrase']
},
value: { type: 'string' },
purpose: { type: 'string' }
},
required: ['type', 'value', 'purpose']
};
const factCheckQuerySchema = {
type: 'object',
properties: {
queryId: { type: 'string' },
queryText: { type: 'string' },
queryType: {
type: 'string',
enum: ['primary-verification', 'cross-reference', 'temporal-context', 'source-specific', 'entity-verification']
},
targetClaims: {
type: 'array',
items: { type: 'string' }
},
searchOperators: {
type: 'array',
items: searchOperatorSchema
},
expectedSourceTypes: {
type: 'array',
items: {
type: 'string',
enum: ['fact-check', 'news', 'academic', 'government', 'social']
}
},
priority: { type: 'integer' },
estimatedRelevance: { type: 'integer' },
alternatives: {
type: 'array',
items: { type: 'string' }
}
},
required: ['queryId', 'queryText', 'queryType', 'targetClaims', 'searchOperators', 'expectedSourceTypes', 'priority', 'estimatedRelevance', 'alternatives']
};
const temporalQuerySchema = {
type: 'object',
properties: {
baseQuery: { type: 'string' },
dateRange: {
type: 'object',
nullable: true,
properties: {
start: { type: 'string' },
end: { type: 'string' }
},
required: ['start', 'end']
},
temporalModifiers: {
type: 'array',
items: { type: 'string' }
},
recencyFocus: {
type: 'string',
enum: ['breaking', 'recent', 'historical', 'any']
}
},
required: ['baseQuery', 'temporalModifiers', 'recencyFocus']
};
const querySynthesisSchema = {
type: 'object',
properties: {
primaryQueries: {
type: 'array',
items: factCheckQuerySchema
},
crossReferenceQueries: {
type: 'array',
items: factCheckQuerySchema
},
temporalQueries: {
type: 'array',
items: temporalQuerySchema
},
sourceTargetedQueries: {
type: 'object',
properties: {
factCheckSites: {
type: 'array',
items: factCheckQuerySchema
},
newsAgencies: {
type: 'array',
items: factCheckQuerySchema
},
academicSources: {
type: 'array',
items: factCheckQuerySchema
},
governmentSources: {
type: 'array',
items: factCheckQuerySchema
}
},
required: ['factCheckSites', 'newsAgencies', 'academicSources', 'governmentSources']
},
queryExecutionPlan: {
type: 'object',
properties: {
phase1: {
type: 'array',
items: { type: 'string' }
},
phase2: {
type: 'array',
items: { type: 'string' }
},
phase3: {
type: 'array',
items: { type: 'string' }
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
// Fact-checking domains
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

Main synthesis method - generates comprehensive query strategy
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
      estimatedSearchTime: Math.ceil(allQueries.length * 2.5), // ~2.5s per query
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

Build comprehensive synthesis prompt
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

PRIMARY VERIFICATION QUERIES (3-5 queries)

One query per major atomic claim
Use exact phrases for specific claims
Include key entities and dates
Target fact-checking sites

EXAMPLE:
Claim: "Biden's infrastructure bill allocated $100B to roads in 2021"
Query: {
queryId: "primary-1",
queryText: "Biden infrastructure bill $100 billion roads 2021",
queryType: "primary-verification",
targetClaims: ["claim-1"],
searchOperators: [
{ type: "site", value: "factcheck.org OR politifact.com OR snopes.com", purpose: "Target fact-checking sites" },
{ type: "exact-phrase", value: "infrastructure bill", purpose: "Find exact references" }
],
expectedSourceTypes: ["fact-check", "news"],
priority: 10,
estimatedRelevance: 95,
alternatives: [
"Biden infrastructure law roads funding 2021",
"infrastructure bill highway spending 2021"
]
}
CROSS-REFERENCE QUERIES (2-4 queries)

Verify context and relationships between claims
Check for contradictory information
Explore different angles

EXAMPLE:
Query: {
queryId: "cross-ref-1",
queryText: "infrastructure spending breakdown 2021 transportation",
queryType: "cross-reference",
targetClaims: ["claim-1", "claim-2"],
searchOperators: [
{ type: "site", value: "reuters.com OR apnews.com", purpose: "Authoritative news sources" }
],
expectedSourceTypes: ["news", "government"],
priority: 7,
estimatedRelevance: 80,
alternatives: []
}
TEMPORAL QUERIES (1-3 queries)

Focus on time-specific verification
Use date operators when dates are mentioned
Check for updates or changes over time

EXAMPLE:
{
baseQuery: "infrastructure bill signing 2021",
dateRange: { start: "2021-01-01", end: "2021-12-31" },
temporalModifiers: ["after:2021-01-01", "before:2022-01-01"],
recencyFocus: "historical"
}
SOURCE-TARGETED QUERIES (distribute 5-10 queries across categories)
a) Fact-Check Sites: Queries optimized for fact-checking databases

Use site: operator with multiple fact-check domains
Include "fact check", "debunked", "verified" keywords

b) News Agencies: Queries for authoritative news sources

Target Reuters, AP, BBC, etc.
Focus on reporting facts, not opinion pieces

c) Academic Sources: Queries for scholarly verification

Target .edu domains, Google Scholar
Include technical terminology
Use filetype:pdf for research papers

d) Government Sources: Queries for official data

Target .gov domains
Look for official statistics, reports, legislation


QUERY EXECUTION PLAN
Organize queries into 3 phases:

Phase 1 (Run immediately): 3-5 highest priority queries

Primary verification queries
Fact-check site queries
Most critical claims


Phase 2 (Run after Phase 1): 3-7 medium priority queries

Cross-reference queries
News agency queries
Context verification


Phase 3 (Run for deep analysis): 2-5 lower priority queries

Academic sources
Historical context
Edge case verification





QUERY OPTIMIZATION BEST PRACTICES:

Keep queries 5-12 words for optimal search results
Use exact phrases (in quotes) for specific claims
Combine operators strategically (site: + intitle:)
Provide 2-3 alternative phrasings for each major query
Assign priority based on claim importance and verifiability
Estimate relevance based on how well the query targets the claim

CRITICAL INSTRUCTIONS:

Generate queries that fact-checkers would actually use
Consider how authoritative sources phrase these topics
Use operators that narrow results to credible sources
Avoid opinion-seeking queries; focus on factual verification
Return ONLY valid JSON

Begin query synthesis now.`;
}
/**

Fallback synthesis when AI fails
*/
private generateFallbackSynthesis(
analysis: DeepTextAnalysis,
extraction: SemanticExtraction
): QuerySynthesisResult {
console.warn('⚠️ Using fallback query synthesis');

const highPriorityKeywords = extraction.searchableKeywordGroups.highPriority.slice(0, 5);
// Generate basic primary queries
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

// Generate fact-check queries
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

Helper: Convert query to actual search string
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
