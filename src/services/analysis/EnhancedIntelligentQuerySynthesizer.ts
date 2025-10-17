// src/services/analysis/EnhancedIntelligentQuerySynthesizer.ts
// Advanced AI-powered query synthesis with entity extraction and color marking

import { vertexAiService } from '../vertexAiService';
import { logger } from '../../utils/logger';
import { parseAIJsonResponse } from '../../utils/jsonParser';

// ===== TYPE DEFINITIONS =====

export interface ColorMarking {
  text: string;
  startIndex: number;
  endIndex: number;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'gray';
  reason: string;
  severity: 'critical' | 'warning' | 'info' | 'verified';
  confidence: number;
}

export interface EntityExtraction {
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  statistics: string[];
  claims: string[];
}

export interface AtomicClaim {
  id: string;
  text: string;
  category: 'factual' | 'statistical' | 'temporal' | 'attributional';
  verifiable: boolean;
  priority: 'high' | 'medium' | 'low';
  entities: string[];
}

export interface TrustedSource {
  domain: string;
  category: string;
  credibilityScore: number;
  rationale: string;
}

export interface TemporalContext {
  hasTemporalClaims: boolean;
  dateReferences: string[];
  suggestedDateFilters: string[];
  recencyImportance: 'critical' | 'important' | 'moderate' | 'low';
}

export interface QuerySynthesisResult {
  queries: string[];
  atomicClaims: AtomicClaim[];
  entities: EntityExtraction;
  trustedSources: TrustedSource[];
  temporalContext: TemporalContext;
  colorMarkings: ColorMarking[];
  metadata: {
    processingTimeMs: number;
    aiModel: string;
    tokensUsed?: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'highly-complex';
  };
}

// ===== MAIN SERVICE CLASS =====

export class EnhancedIntelligentQuerySynthesizer {
  private static instance: EnhancedIntelligentQuerySynthesizer;

  private constructor() {}

  static getInstance(): EnhancedIntelligentQuerySynthesizer {
    if (!EnhancedIntelligentQuerySynthesizer.instance) {
      EnhancedIntelligentQuerySynthesizer.instance = new EnhancedIntelligentQuerySynthesizer();
    }
    return EnhancedIntelligentQuerySynthesizer.instance;
  }

  /**
   * Main synthesis method - generates queries, entities, and color markings
   */
  async synthesize(text: string, context?: string): Promise<QuerySynthesisResult> {
    const startTime = Date.now();
    logger.info('🔍 Starting Enhanced Query Synthesis', { textLength: text.length });

    try {
      // Run all analyses in parallel for speed
      const [
        queriesResult,
        entitiesResult,
        claimsResult,
        temporalResult,
        markingsResult
      ] = await Promise.allSettled([
        this.generateQueries(text, context),
        this.extractEntities(text),
        this.decomposeIntoClaims(text),
        this.analyzeTemporalContext(text),
        this.generateColorMarkings(text)
      ]);

      // Extract successful results with fallbacks
      const queries = queriesResult.status === 'fulfilled' ? queriesResult.value : this.generateFallbackQueries(text);
      const entities = entitiesResult.status === 'fulfilled' ? entitiesResult.value : this.getEmptyEntities();
      const claims = claimsResult.status === 'fulfilled' ? claimsResult.value : [];
      const temporal = temporalResult.status === 'fulfilled' ? temporalResult.value : this.getDefaultTemporal();
      const markings = markingsResult.status === 'fulfilled' ? markingsResult.value : [];

      // Determine trusted sources based on entities and content
      const trustedSources = this.identifyTrustedSources(entities, text);

      const processingTime = Date.now() - startTime;
      const complexity = this.assessComplexity(text, claims.length, entities);

      logger.info('✅ Query Synthesis Complete', {
        processingTimeMs: processingTime,
        queriesGenerated: queries.length,
        claimsIdentified: claims.length,
        markingsCreated: markings.length
      });

      return {
        queries,
        atomicClaims: claims,
        entities,
        trustedSources,
        temporalContext: temporal,
        colorMarkings: markings,
        metadata: {
          processingTimeMs: processingTime,
          aiModel: 'gemini-1.5-flash-001',
          complexity
        }
      };

    } catch (error: any) {
      logger.error('Query synthesis failed', error);
      throw new Error(`Query synthesis failed: ${error.message}`);
    }
  }

  // ===== AI-POWERED METHODS =====

  /**
   * Generate 8-10 targeted search queries using Vertex AI
   */
  private async generateQueries(text: string, context?: string): Promise<string[]> {
    const prompt = this.buildQueryGenerationPrompt(text, context);

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.4,
        maxOutputTokens: 2048
      });

      const parsed = parseAIJsonResponse(response);
      
      if (parsed.queries && Array.isArray(parsed.queries)) {
        logger.info('✅ Vertex AI generated queries', { count: parsed.queries.length });
        return parsed.queries.slice(0, 10); // Max 10 queries
      }

      throw new Error('Invalid query response format');
    } catch (error) {
      logger.warn('Vertex AI query generation failed, using fallback', error);
      return this.generateFallbackQueries(text);
    }
  }

  /**
   * Extract entities using Vertex AI
   */
  private async extractEntities(text: string): Promise<EntityExtraction> {
    const prompt = this.buildEntityExtractionPrompt(text);

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.2,
        maxOutputTokens: 1024
      });

      const parsed = parseAIJsonResponse(response);
      
      logger.info('✅ Vertex AI extracted entities', {
        people: parsed.people?.length || 0,
        organizations: parsed.organizations?.length || 0
      });

      return {
        people: parsed.people || [],
        organizations: parsed.organizations || [],
        locations: parsed.locations || [],
        dates: parsed.dates || [],
        statistics: parsed.statistics || [],
        claims: parsed.claims || []
      };
    } catch (error) {
      logger.warn('Entity extraction failed, using heuristics', error);
      return this.extractEntitiesHeuristic(text);
    }
  }

  /**
   * Decompose text into atomic verifiable claims
   */
  private async decomposeIntoClaims(text: string): Promise<AtomicClaim[]> {
    const prompt = this.buildClaimDecompositionPrompt(text);

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 2048
      });

      const parsed = parseAIJsonResponse(response);
      
      if (parsed.claims && Array.isArray(parsed.claims)) {
        logger.info('✅ Vertex AI decomposed claims', { count: parsed.claims.length });
        return parsed.claims.map((claim: any, index: number) => ({
          id: `claim_${Date.now()}_${index}`,
          text: claim.text,
          category: claim.category || 'factual',
          verifiable: claim.verifiable !== false,
          priority: claim.priority || 'medium',
          entities: claim.entities || []
        }));
      }

      throw new Error('Invalid claims response format');
    } catch (error) {
      logger.warn('Claim decomposition failed, using heuristics', error);
      return this.decomposeClaimsHeuristic(text);
    }
  }

  /**
   * Analyze temporal context and generate date filters
   */
  private async analyzeTemporalContext(text: string): Promise<TemporalContext> {
    const prompt = this.buildTemporalAnalysisPrompt(text);

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.2,
        maxOutputTokens: 512
      });

      const parsed = parseAIJsonResponse(response);
      
      return {
        hasTemporalClaims: parsed.hasTemporalClaims || false,
        dateReferences: parsed.dateReferences || [],
        suggestedDateFilters: parsed.suggestedDateFilters || [],
        recencyImportance: parsed.recencyImportance || 'moderate'
      };
    } catch (error) {
      logger.warn('Temporal analysis failed, using default', error);
      return this.getDefaultTemporal();
    }
  }

  /**
   * Generate color markings for text editor integration
   */
  private async generateColorMarkings(text: string): Promise<ColorMarking[]> {
    const prompt = this.buildColorMarkingPrompt(text);

    try {
      const response = await vertexAiService.generateText(prompt, {
        temperature: 0.3,
        maxOutputTokens: 2048
      });

      const parsed = parseAIJsonResponse(response);
      
      if (parsed.markings && Array.isArray(parsed.markings)) {
        logger.info('✅ Vertex AI generated color markings', { count: parsed.markings.length });
        return parsed.markings.map((m: any) => ({
          text: m.text,
          startIndex: m.startIndex || 0,
          endIndex: m.endIndex || 0,
          color: m.color || 'yellow',
          reason: m.reason || '',
          severity: m.severity || 'warning',
          confidence: m.confidence || 70
        }));
      }

      return [];
    } catch (error) {
      logger.warn('Color marking generation failed', error);
      return [];
    }
  }

  // ===== PROMPT BUILDERS =====

  private buildQueryGenerationPrompt(text: string, context?: string): string {
    return `You are an expert fact-checker generating search queries. Analyze this ${context || 'claim'} and generate 8-10 targeted search queries that would help verify its accuracy.

TEXT TO ANALYZE:
"""
${text}
"""

INSTRUCTIONS:
- Generate queries that target specific verifiable facts
- Include queries for key entities (people, organizations, places)
- Include temporal queries (dates, events, timelines)
- Include statistical verification queries for numbers
- Mix broad and specific queries
- Optimize for Google search and news databases

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "queries": [
    "specific search query 1",
    "specific search query 2",
    ...
  ]
}`;
  }

  private buildEntityExtractionPrompt(text: string): string {
    return `Extract all named entities from this text. Be thorough and accurate.

TEXT:
"""
${text}
"""

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "people": ["person names"],
  "organizations": ["company/org names"],
  "locations": ["places"],
  "dates": ["dates and times"],
  "statistics": ["numbers and stats"],
  "claims": ["key factual claims"]
}`;
  }

  private buildClaimDecompositionPrompt(text: string): string {
    return `Decompose this text into atomic, verifiable claims. Each claim should be a single statement that can be independently fact-checked.

TEXT:
"""
${text}
"""

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "claims": [
    {
      "text": "atomic claim statement",
      "category": "factual|statistical|temporal|attributional",
      "verifiable": true,
      "priority": "high|medium|low",
      "entities": ["related entities"]
    }
  ]
}`;
  }

  private buildTemporalAnalysisPrompt(text: string): string {
    return `Analyze temporal context in this text. Identify dates, time periods, and recency requirements.

TEXT:
"""
${text}
"""

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "hasTemporalClaims": true,
  "dateReferences": ["dates mentioned"],
  "suggestedDateFilters": ["date filter strings like '2024-01-01..2024-12-31'"],
  "recencyImportance": "critical|important|moderate|low"
}`;
  }

  private buildColorMarkingPrompt(text: string): string {
    return `Analyze this text and generate color markings for a text editor. Mark claims by verifiability and importance.

COLORS:
- RED: Likely false or highly suspicious claims (critical)
- YELLOW: Unverified or questionable claims (warning)
- GREEN: Likely verifiable facts (verified)
- BLUE: Context/background information (info)
- GRAY: Subjective/opinion statements (info)

TEXT:
"""
${text}
"""

For each marking, provide the exact text, its position, color, reason, and severity.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "markings": [
    {
      "text": "exact text to mark",
      "startIndex": 0,
      "endIndex": 10,
      "color": "red|yellow|green|blue|gray",
      "reason": "why this is marked",
      "severity": "critical|warning|info|verified",
      "confidence": 85
    }
  ]
}`;
  }

  // ===== HELPER METHODS =====

  private identifyTrustedSources(entities: EntityExtraction, text: string): TrustedSource[] {
    const sources: TrustedSource[] = [];
    const textLower = text.toLowerCase();

    // Government/Official sources
    if (entities.organizations.some(org => /government|police|court|fbi|cia/i.test(org))) {
      sources.push({
        domain: '.gov',
        category: 'government',
        credibilityScore: 95,
        rationale: 'Official government sources for legal/crime verification'
      });
    }

    // News sources for incidents
    if (textLower.includes('arrest') || textLower.includes('incident') || textLower.includes('walmart')) {
      sources.push(
        {
          domain: 'apnews.com',
          category: 'news',
          credibilityScore: 98,
          rationale: 'High-credibility news for incident verification'
        },
        {
          domain: 'reuters.com',
          category: 'news',
          credibilityScore: 98,
          rationale: 'International news agency'
        }
      );
    }

    // Academic sources for statistics
    if (entities.statistics.length > 0) {
      sources.push({
        domain: '.edu',
        category: 'academic',
        credibilityScore: 90,
        rationale: 'Academic institutions for statistical verification'
      });
    }

    return sources;
  }

  private assessComplexity(text: string, claimCount: number, entities: EntityExtraction): 'simple' | 'moderate' | 'complex' | 'highly-complex' {
    const wordCount = text.split(/\s+/).length;
    const entityCount = Object.values(entities).flat().length;

    if (wordCount < 50 && claimCount <= 2) return 'simple';
    if (wordCount < 150 && claimCount <= 5) return 'moderate';
    if (wordCount < 300 && claimCount <= 10) return 'complex';
    return 'highly-complex';
  }

  // ===== FALLBACK METHODS =====

  private generateFallbackQueries(text: string): string[] {
    const queries: string[] = [];
    const words = text.split(/\s+/);
    
    // Main query
    queries.push(text.substring(0, 100));
    
    // Extract potential names (capitalized words)
    const names = words.filter(w => /^[A-Z][a-z]+/.test(w));
    if (names.length > 0) {
      queries.push(names.slice(0, 3).join(' '));
    }
    
    // Extract dates
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b[A-Z][a-z]+ \d{1,2},? \d{4}\b/g;
    const dates = text.match(datePattern);
    if (dates) {
      queries.push(`${dates[0]} incident`);
    }
    
    // Extract numbers
    const numbers = text.match(/\$[\d,]+|\d+/g);
    if (numbers) {
      queries.push(`${numbers[0]} verification`);
    }

    return queries.slice(0, 8);
  }

  private extractEntitiesHeuristic(text: string): EntityExtraction {
    return {
      people: this.extractNames(text),
      organizations: this.extractOrganizations(text),
      locations: this.extractLocations(text),
      dates: this.extractDates(text),
      statistics: this.extractStatistics(text),
      claims: [text.substring(0, 200)]
    };
  }

  private extractNames(text: string): string[] {
    const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g;
    return Array.from(new Set(text.match(namePattern) || []));
  }

  private extractOrganizations(text: string): string[] {
    const orgPatterns = [/Walmart/g, /Police Department/g, /Sheriff's Office/g, /Secret Service/g];
    const orgs: string[] = [];
    orgPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) orgs.push(...matches);
    });
    return Array.from(new Set(orgs));
  }

  private extractLocations(text: string): string[] {
    const locationPattern = /\b[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)+\b/g;
    return Array.from(new Set(text.match(locationPattern) || []));
  }

  private extractDates(text: string): string[] {
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b[A-Z][a-z]+ \d{1,2},? \d{4}\b/g;
    return Array.from(new Set(text.match(datePattern) || []));
  }

  private extractStatistics(text: string): string[] {
    const statPattern = /\$[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:percent|%|million|billion|thousand)/gi;
    return Array.from(new Set(text.match(statPattern) || []));
  }

  private decomposeClaimsHeuristic(text: string): AtomicClaim[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 5).map((sentence, index) => ({
      id: `claim_${Date.now()}_${index}`,
      text: sentence.trim(),
      category: 'factual' as const,
      verifiable: true,
      priority: index === 0 ? 'high' as const : 'medium' as const,
      entities: []
    }));
  }

  private getEmptyEntities(): EntityExtraction {
    return {
      people: [],
      organizations: [],
      locations: [],
      dates: [],
      statistics: [],
      claims: []
    };
  }

  private getDefaultTemporal(): TemporalContext {
    return {
      hasTemporalClaims: false,
      dateReferences: [],
      suggestedDateFilters: [],
      recencyImportance: 'moderate'
    };
  }
}

// Export singleton instance
export const querysynthesizer = EnhancedIntelligentQuerySynthesizer.getInstance();
