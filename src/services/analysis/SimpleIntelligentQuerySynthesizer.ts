// src/services/analysis/EnhancedIntelligentQuerySynthesizer.ts
import { vertexAiService } from '../vertexAiService';
import { logger } from '../../utils/logger';

export interface AtomicClaim {
  id: string;
  text: string;
  priority: number; // 1-10, higher = more important
  verifiable: boolean;
  requiresContext: boolean;
}

export interface ExtractedEntity {
  name: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'EVENT' | 'STATISTIC' | 'PRODUCT' | 'LAW';
  relevance: number; // 0.0-1.0
  aliases?: string[];
}

export interface SearchQuery {
  query: string;
  type: 'fact_check' | 'academic' | 'news' | 'government' | 'expert' | 'primary_source' | 'contextual';
  priority: number; // 1-10
  expectedSources?: string[]; // Suggested domains/sources
  reasoning: string;
  claimId?: string; // Which atomic claim this query targets
}

export interface ClaimAnalysis {
  atomicClaims: AtomicClaim[];
  entities: ExtractedEntity[];
  claimType: 'factual' | 'opinion' | 'prediction' | 'mixed' | 'comparative';
  complexity: 'simple' | 'moderate' | 'complex';
  domain: string; // e.g., "medical", "political", "scientific", "historical"
  temporalContext: 'current' | 'recent' | 'historical' | 'future';
  controversialityScore: number; // 0.0-1.0
}

export interface EnhancedQuerySet {
  queries: SearchQuery[];
  claimAnalysis: ClaimAnalysis;
  searchStrategy: string;
  estimatedSourcesNeeded: number;
}

/**
 * Industry-standard query synthesizer using Vertex AI's full analytical capabilities
 * This replaces the simple version with multi-stage analysis and intelligent query generation
 */
export class EnhancedIntelligentQuerySynthesizer {
  private static instance: EnhancedIntelligentQuerySynthesizer;

  private constructor() {}

  static getInstance(): EnhancedIntelligentQuerySynthesizer {
    if (!this.instance) {
      this.instance = new EnhancedIntelligentQuerySynthesizer();
    }
    return this.instance;
  }

  /**
   * STAGE 1: Deep Claim Analysis
   * Break down the claim into verifiable atomic statements and extract all relevant entities
   */
  async analyzeClaimStructure(claim: string): Promise<ClaimAnalysis> {
    const prompt = `You are an expert fact-checker analyzing a claim for verification. Perform a deep structural analysis.

CLAIM: "${claim}"

Your task:
1. Break the claim into ATOMIC CLAIMS - smallest verifiable statements that cannot be subdivided
2. Extract ALL named entities with their types
3. Classify the claim type and domain
4. Assess complexity and controversiality

Respond with ONLY valid JSON (no markdown blocks, no explanation):
{
  "atomicClaims": [
    {
      "id": "claim_1",
      "text": "specific verifiable statement",
      "priority": 8,
      "verifiable": true,
      "requiresContext": false
    }
  ],
  "entities": [
    {
      "name": "entity name",
      "type": "PERSON",
      "relevance": 0.95,
      "aliases": ["alternative name"]
    }
  ],
  "claimType": "factual",
  "complexity": "moderate",
  "domain": "political",
  "temporalContext": "current",
  "controversialityScore": 0.7
}`;

    try {
      logger.info('🔍 Stage 1: Analyzing claim structure with Vertex AI');
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.1, // Low temperature for factual analysis
        maxOutputTokens: 3000
      });

      const cleaned = this.cleanJsonResponse(response);
      const analysis = JSON.parse(cleaned) as ClaimAnalysis;
      
      logger.info('✅ Claim analysis complete', {
        atomicClaims: analysis.atomicClaims.length,
        entities: analysis.entities.length,
        complexity: analysis.complexity,
        domain: analysis.domain
      });

      return analysis;
    } catch (error) {
      logger.error('❌ Claim analysis failed, using fallback', { error });
      return this.createFallbackAnalysis(claim);
    }
  }

  /**
   * STAGE 2: Strategic Query Generation
   * Generate targeted search queries based on claim analysis
   */
  async generateStrategicQueries(
    originalClaim: string,
    analysis: ClaimAnalysis
  ): Promise<SearchQuery[]> {
    const entitiesStr = analysis.entities
      .filter(e => e.relevance > 0.5)
      .map(e => `${e.name} (${e.type}, relevance: ${e.relevance})`)
      .join(', ');

    const claimsStr = analysis.atomicClaims
      .map(c => `[Priority ${c.priority}] ${c.text}`)
      .join('\n');

    const prompt = `You are a professional fact-checker designing search queries to verify claims. Generate 8-12 strategic queries.

ORIGINAL CLAIM: "${originalClaim}"

ATOMIC CLAIMS:
${claimsStr}

KEY ENTITIES: ${entitiesStr}

DOMAIN: ${analysis.domain}
COMPLEXITY: ${analysis.complexity}
CONTROVERSIALITY: ${analysis.controversialityScore}

Query Strategy Guidelines:
1. **Fact-Check Queries** (2-3): Target fact-checking sites directly
   - Use exact phrases when possible
   - Include "fact check", "debunk", "verify"

2. **Academic/Expert Queries** (2-3): For scientific/technical claims
   - Target .edu, .gov, academic journals
   - Use technical terminology
   - Include domain experts' names if relevant

3. **News Queries** (2-3): For current events
   - Use journalist-verified sources
   - Include publication dates/timeframes
   - Cross-reference multiple outlets

4. **Primary Source Queries** (1-2): For official records
   - Target government databases, official statements
   - Use specific document types (report, statement, transcript)

5. **Contextual Queries** (1-2): For background understanding
   - Broader topic exploration
   - Historical context
   - Related events/precedents

Respond with ONLY valid JSON:
{
  "queries": [
    {
      "query": "optimized search string",
      "type": "fact_check",
      "priority": 10,
      "expectedSources": ["snopes.com", "politifact.com"],
      "reasoning": "why this query is effective",
      "claimId": "claim_1"
    }
  ],
  "searchStrategy": "overall approach description",
  "estimatedSourcesNeeded": 15
}`;

    try {
      logger.info('🎯 Stage 2: Generating strategic queries with Vertex AI');
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.3, // Moderate temperature for creative query generation
        maxOutputTokens: 4000
      });

      const cleaned = this.cleanJsonResponse(response);
      const result = JSON.parse(cleaned);
      
      const queries = result.queries as SearchQuery[];
      
      logger.info('✅ Query generation complete', {
        totalQueries: queries.length,
        byType: this.countQueriesByType(queries)
      });

      return queries;
    } catch (error) {
      logger.error('❌ Query generation failed, using fallback', { error });
      return this.createFallbackQueries(originalClaim, analysis);
    }
  }

  /**
   * STAGE 3: Query Optimization
   * Refine queries based on domain and expected source types
   */
  optimizeQueriesForDomain(
    queries: SearchQuery[],
    domain: string
  ): SearchQuery[] {
    const domainOptimizations: Record<string, (q: SearchQuery) => SearchQuery> = {
      medical: (q) => ({
        ...q,
        query: q.type === 'academic' 
          ? `${q.query} site:nih.gov OR site:who.int OR site:pubmed.ncbi.nlm.nih.gov`
          : q.query,
        expectedSources: [...(q.expectedSources || []), 'nih.gov', 'who.int', 'cdc.gov']
      }),
      
      scientific: (q) => ({
        ...q,
        query: q.type === 'academic'
          ? `${q.query} site:nature.com OR site:science.org OR site:.edu`
          : q.query,
        expectedSources: [...(q.expectedSources || []), 'nature.com', 'science.org']
      }),
      
      political: (q) => ({
        ...q,
        query: q.type === 'fact_check'
          ? `${q.query} site:politifact.com OR site:factcheck.org OR site:snopes.com`
          : q.query,
        expectedSources: [...(q.expectedSources || []), 'politifact.com', 'factcheck.org']
      }),
      
      historical: (q) => ({
        ...q,
        query: q.type === 'primary_source'
          ? `${q.query} site:.gov OR site:.edu OR site:archives.gov`
          : q.query,
        expectedSources: [...(q.expectedSources || []), 'archives.gov', 'loc.gov']
      }),
      
      legal: (q) => ({
        ...q,
        query: q.type === 'government'
          ? `${q.query} site:.gov OR site:law.cornell.edu OR site:supremecourt.gov`
          : q.query,
        expectedSources: [...(q.expectedSources || []), 'congress.gov', 'supremecourt.gov']
      })
    };

    const optimizer = domainOptimizations[domain];
    if (!optimizer) return queries;

    return queries.map(optimizer);
  }

  /**
   * Main orchestration method - Complete pipeline
   */
  async generateEnhancedQuerySet(claim: string): Promise<EnhancedQuerySet> {
    const startTime = Date.now();
    
    logger.info('🚀 Starting enhanced query synthesis pipeline', {
      claimLength: claim.length
    });

    // Stage 1: Analyze claim structure
    const claimAnalysis = await this.analyzeClaimStructure(claim);

    // Stage 2: Generate strategic queries
    const rawQueries = await this.generateStrategicQueries(claim, claimAnalysis);

    // Stage 3: Optimize for domain
    const optimizedQueries = this.optimizeQueriesForDomain(
      rawQueries,
      claimAnalysis.domain
    );

    // Sort by priority (descending)
    const sortedQueries = optimizedQueries.sort((a, b) => b.priority - a.priority);

    const result: EnhancedQuerySet = {
      queries: sortedQueries,
      claimAnalysis,
      searchStrategy: `Multi-tier verification strategy for ${claimAnalysis.complexity} ${claimAnalysis.domain} claim`,
      estimatedSourcesNeeded: Math.max(15, claimAnalysis.atomicClaims.length * 3)
    };

    logger.info('✅ Enhanced query synthesis complete', {
      processingTime: Date.now() - startTime,
      totalQueries: sortedQueries.length,
      estimatedSources: result.estimatedSourcesNeeded
    });

    return result;
  }

  /**
   * Backward compatibility method - returns simple format
   */
  async generateQueries(claim: string): Promise<{ keywordQuery: string; contextualQuery: string }> {
    try {
      const enhanced = await this.generateEnhancedQuerySet(claim);
      
      // Extract keyword query (highest priority fact-check or academic query)
      const keywordQuery = enhanced.queries
        .filter(q => q.type === 'fact_check' || q.type === 'academic')
        .sort((a, b) => b.priority - a.priority)[0]?.query || claim;

      // Extract contextual query (lowest priority contextual query)
      const contextualQuery = enhanced.queries
        .filter(q => q.type === 'contextual')
        .sort((a, b) => a.priority - b.priority)[0]?.query || '';

      return { keywordQuery, contextualQuery };
    } catch (error) {
      logger.error('Fallback to simple query generation', { error });
      return {
        keywordQuery: claim.split(' ').slice(0, 10).join(' '),
        contextualQuery: ''
      };
    }
  }

  // ===== Helper Methods =====

  private cleanJsonResponse(response: string): string {
    return response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^[^{[]*/, '') // Remove text before first { or [
      .replace(/[^}\]]*$/, '') // Remove text after last } or ]
      .trim();
  }

  private countQueriesByType(queries: SearchQuery[]): Record<string, number> {
    return queries.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private createFallbackAnalysis(claim: string): ClaimAnalysis {
    return {
      atomicClaims: [{
        id: 'claim_1',
        text: claim,
        priority: 10,
        verifiable: true,
        requiresContext: false
      }],
      entities: [],
      claimType: 'factual',
      complexity: 'simple',
      domain: 'general',
      temporalContext: 'current',
      controversialityScore: 0.5
    };
  }

  private createFallbackQueries(claim: string, analysis: ClaimAnalysis): SearchQuery[] {
    const baseQuery = claim.substring(0, 100);
    
    return [
      {
        query: `"${baseQuery}" fact check`,
        type: 'fact_check',
        priority: 10,
        reasoning: 'Fallback fact-check query',
        expectedSources: ['snopes.com', 'factcheck.org']
      },
      {
        query: baseQuery,
        type: 'news',
        priority: 8,
        reasoning: 'Fallback news query',
        expectedSources: []
      },
      {
        query: `${analysis.domain} ${baseQuery.split(' ').slice(0, 5).join(' ')}`,
        type: 'contextual',
        priority: 6,
        reasoning: 'Fallback contextual query',
        expectedSources: []
      }
    ];
  }
}

// Export singleton instance
export const enhancedIntelligentQuerySynthesizer = EnhancedIntelligentQuerySynthesizer.getInstance();

// Keep backward compatibility
export const simpleIntelligentQuerySynthesizer = {
  async generateQueries(claim: string): Promise<{ keywordQuery: string; contextualQuery: string }> {
    return enhancedIntelligentQuerySynthesizer.generateQueries(claim);
  }
};
