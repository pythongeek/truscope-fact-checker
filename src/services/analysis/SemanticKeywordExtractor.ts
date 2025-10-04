// src/services/analysis/SemanticKeywordExtractor.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiModel } from '../apiKeyService';
import { parseAIJsonResponse } from '../../utils/jsonParser';
import { DeepTextAnalysis } from './AdvancedTextAnalyzer';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SemanticKeyword {
  keyword: string;
  category: 'primary' | 'secondary' | 'contextual' | 'modifier';
  relevance: number; // 0-100
  synonyms: string[];
  relatedTerms: string[];
  searchWeight: number; // 0-10 (10 = most important for search)
}

export interface ConceptCluster {
  mainConcept: string;
  relatedConcepts: string[];
  domainCategory: 'politics' | 'science' | 'health' | 'business' | 'technology' | 'sports' | 'entertainment' | 'general';
  specificityLevel: 'broad' | 'specific' | 'highly-specific';
}

export interface DomainTerminology {
  technicalTerms: string[];
  jargon: string[];
  acronyms: Array<{ acronym: string; expansion: string }>;
  domainSpecificConcepts: string[];
}

export interface SemanticExtraction {
  primaryKeywords: SemanticKeyword[];
  secondaryKeywords: SemanticKeyword[];
  conceptClusters: ConceptCluster[];
  domainTerminology: DomainTerminology;
  searchableKeywordGroups: {
    highPriority: string[];
    mediumPriority: string[];
    lowPriority: string[];
  };
  keywordDensity: Map<string, number>;
  metadata: {
    totalKeywords: number;
    uniqueConcepts: number;
    processingTimestamp: string;
  };
}

// Helper function to extract text from response
const extractTextFromGeminiResponse = (result: any): string => {
    if (!result || !result.response) {
        throw new Error('Invalid response from AI model');
    }
    const responseText = result.response.text();
    if (typeof responseText !== 'string' || !responseText) {
        throw new Error('Empty response from AI model');
    }
    return responseText.trim();
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class SemanticKeywordExtractor {
  private static instance: SemanticKeywordExtractor;
  private ai: GoogleGenerativeAI;

  private constructor() {
    this.ai = new GoogleGenerativeAI(getGeminiApiKey());
  }

  static getInstance(): SemanticKeywordExtractor {
    if (!SemanticKeywordExtractor.instance) {
      SemanticKeywordExtractor.instance = new SemanticKeywordExtractor();
    }
    return SemanticKeywordExtractor.instance;
  }

  /**
   * Extract semantic keywords from deep text analysis
   */
  async extractKeywords(
    textAnalysis: DeepTextAnalysis
  ): Promise<SemanticExtraction> {
    console.log('🔑 Starting semantic keyword extraction...');
    const startTime = Date.now();

    try {
      const prompt = this.buildExtractionPrompt(textAnalysis);

      const model = this.ai.getGenerativeModel({ 
        model: getGeminiModel(),
        generationConfig: {
          temperature: 0.2,
        }
      });

      const result = await model.generateContent(prompt);
      const responseText = extractTextFromGeminiResponse(result);
      const extraction = parseAIJsonResponse(responseText);

      const keywordDensity = this.calculateKeywordDensity(
        textAnalysis.originalText,
        extraction.primaryKeywords || []
      );

      const enrichedExtraction: SemanticExtraction = {
        primaryKeywords: extraction.primaryKeywords || [],
        secondaryKeywords: extraction.secondaryKeywords || [],
        conceptClusters: extraction.conceptClusters || [],
        domainTerminology: extraction.domainTerminology || {
          technicalTerms: [],
          jargon: [],
          acronyms: [],
          domainSpecificConcepts: []
        },
        searchableKeywordGroups: extraction.searchableKeywordGroups || {
          highPriority: [],
          mediumPriority: [],
          lowPriority: []
        },
        keywordDensity,
        metadata: {
          totalKeywords: (extraction.primaryKeywords?.length || 0) + (extraction.secondaryKeywords?.length || 0),
          uniqueConcepts: extraction.conceptClusters?.length || 0,
          processingTimestamp: new Date().toISOString()
        }
      };

      const processingTime = Date.now() - startTime;
      console.log(`✅ Semantic extraction completed in ${processingTime}ms`);
      console.log(`   - Primary keywords: ${enrichedExtraction.primaryKeywords.length}`);
      console.log(`   - Concept clusters: ${enrichedExtraction.conceptClusters.length}`);

      return enrichedExtraction;

    } catch (error) {
      console.error('❌ Semantic extraction failed:', error);
      return this.generateFallbackExtraction(textAnalysis);
    }
  }

  /**
   * Build semantic extraction prompt
   */
  private buildExtractionPrompt(analysis: DeepTextAnalysis): string {
    return `You are an expert in semantic analysis and information retrieval. Extract comprehensive semantic keywords from the analyzed text.

ORIGINAL TEXT:
"${analysis.originalText}"

EXTRACTED ENTITIES:
${JSON.stringify(analysis.namedEntities.slice(0, 10), null, 2)}

ATOMIC CLAIMS:
${JSON.stringify(analysis.atomicClaims.slice(0, 5), null, 2)}

YOUR TASKS:

1. PRIMARY KEYWORDS (5-10 keywords) - Most important concepts for fact-checking
2. SECONDARY KEYWORDS (5-15 keywords) - Supporting concepts
3. CONCEPT CLUSTERS - Group related concepts
4. DOMAIN TERMINOLOGY - Technical terms, jargon, acronyms
5. SEARCHABLE KEYWORD GROUPS - High/Medium/Low priority

CRITICAL: Respond with ONLY valid JSON in this format:
{
  "primaryKeywords": [
    {
      "keyword": "string",
      "category": "primary|secondary|contextual|modifier",
      "relevance": 0-100,
      "synonyms": ["string"],
      "relatedTerms": ["string"],
      "searchWeight": 0-10
    }
  ],
  "secondaryKeywords": [],
  "conceptClusters": [
    {
      "mainConcept": "string",
      "relatedConcepts": ["string"],
      "domainCategory": "politics|science|health|business|technology|sports|entertainment|general",
      "specificityLevel": "broad|specific|highly-specific"
    }
  ],
  "domainTerminology": {
    "technicalTerms": [],
    "jargon": [],
    "acronyms": [{"acronym": "GDP", "expansion": "Gross Domestic Product"}],
    "domainSpecificConcepts": []
  },
  "searchableKeywordGroups": {
    "highPriority": ["keyword1", "keyword2"],
    "mediumPriority": ["keyword3"],
    "lowPriority": ["keyword4"]
  }
}

Focus on VERIFIABLE concepts. Generate synonyms that fact-checking sources would use. JSON only, no explanatory text.`;
  }

  /**
   * Calculate keyword density (how often keywords appear)
   */
  private calculateKeywordDensity(
    text: string,
    keywords: SemanticKeyword[]
  ): Map<string, number> {
    const densityMap = new Map<string, number>();
    const lowerText = text.toLowerCase();

    keywords.forEach(kw => {
      const regex = new RegExp(`\\b${kw.keyword.toLowerCase()}\\b`, 'g');
      const matches = lowerText.match(regex);
      densityMap.set(kw.keyword, matches ? matches.length : 0);
    });

    return densityMap;
  }

  /**
   * Fallback extraction when AI fails
   */
  private generateFallbackExtraction(analysis: DeepTextAnalysis): SemanticExtraction {
    console.warn('⚠️ Using fallback semantic extraction');

    // Extract keywords from entities
    const primaryKeywords: SemanticKeyword[] = analysis.namedEntities
      .slice(0, 5)
      .map(entity => ({
        keyword: entity.text,
        category: 'primary' as const,
        relevance: entity.relevance,
        synonyms: entity.aliases || [],
        relatedTerms: [],
        searchWeight: Math.min(10, Math.round(entity.relevance / 10))
      }));

    // Extract from claims
    const secondaryKeywords: SemanticKeyword[] = analysis.atomicClaims
      .slice(0, 3)
      .flatMap(claim => {
        const words = claim.claimText.split(/\s+/)
          .filter(w => w.length > 4 && /^[A-Z]/.test(w))
          .slice(0, 2);
        
        return words.map(word => ({
          keyword: word,
          category: 'secondary' as const,
          relevance: 50,
          synonyms: [],
          relatedTerms: [],
          searchWeight: 5
        }));
      });

    const conceptClusters: ConceptCluster[] = [{
      mainConcept: primaryKeywords[0]?.keyword || 'general',
      relatedConcepts: primaryKeywords.slice(1, 4).map(k => k.keyword),
      domainCategory: 'general' as const,
      specificityLevel: 'broad' as const
    }];

    return {
      primaryKeywords,
      secondaryKeywords,
      conceptClusters,
      domainTerminology: {
        technicalTerms: [],
        jargon: [],
        acronyms: [],
        domainSpecificConcepts: []
      },
      searchableKeywordGroups: {
        highPriority: primaryKeywords.slice(0, 5).map(k => k.keyword),
        mediumPriority: secondaryKeywords.slice(0, 5).map(k => k.keyword),
        lowPriority: []
      },
      keywordDensity: new Map(),
      metadata: {
        totalKeywords: primaryKeywords.length + secondaryKeywords.length,
        uniqueConcepts: conceptClusters.length,
        processingTimestamp: new Date().toISOString()
      }
    };
  }
}
