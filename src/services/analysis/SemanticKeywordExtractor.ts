// src/services/analysis/SemanticKeywordExtractor.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiModel } from '../apiKeyService';
import { parseAIJsonResponse } from '../../utils/jsonParser';
import { DeepTextAnalysis, NamedEntity, AtomicClaim } from './AdvancedTextAnalyzer';

// Helper function to extract text from different SDK response structures
const extractTextFromGeminiResponse = (result: any): string => {
    if (!result || !result.response) {
        throw new Error('Invalid response from AI model: "response" property is missing.');
    }
    const responseText = result.response.text();
    if (typeof responseText !== 'string' || !responseText) {
        console.error('Empty or invalid response text from AI model.', result);
        throw new Error('Empty or invalid response text from AI model.');
    }
    return responseText.trim();
};

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
// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================
const semanticKeywordSchema = {
    type: SchemaType.OBJECT,
    properties: {
        keyword: { type: SchemaType.STRING },
        category: {
            type: SchemaType.STRING,
            enum: ['primary', 'secondary', 'contextual', 'modifier']
        },
        relevance: { type: SchemaType.INTEGER },
        synonyms: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        relatedTerms: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        searchWeight: { type: SchemaType.INTEGER }
    },
    required: ['keyword', 'category', 'relevance', 'synonyms', 'relatedTerms', 'searchWeight']
};
const conceptClusterSchema = {
    type: SchemaType.OBJECT,
    properties: {
        mainConcept: { type: SchemaType.STRING },
        relatedConcepts: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        domainCategory: {
            type: SchemaType.STRING,
            enum: ['politics', 'science', 'health', 'business', 'technology', 'sports', 'entertainment', 'general']
        },
        specificityLevel: {
            type: SchemaType.STRING,
            enum: ['broad', 'specific', 'highly-specific']
        }
    },
    required: ['mainConcept', 'relatedConcepts', 'domainCategory', 'specificityLevel']
};
const domainTerminologySchema = {
    type: SchemaType.OBJECT,
    properties: {
        technicalTerms: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        jargon: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        acronyms: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    acronym: { type: SchemaType.STRING },
                    expansion: { type: SchemaType.STRING }
                },
                required: ['acronym', 'expansion']
            }
        },
        domainSpecificConcepts: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        }
    },
    required: ['technicalTerms', 'jargon', 'acronyms', 'domainSpecificConcepts']
};
const semanticExtractionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        primaryKeywords: {
            type: SchemaType.ARRAY,
            items: semanticKeywordSchema
        },
        secondaryKeywords: {
            type: SchemaType.ARRAY,
            items: semanticKeywordSchema
        },
        conceptClusters: {
            type: SchemaType.ARRAY,
            items: conceptClusterSchema
        },
        domainTerminology: domainTerminologySchema,
        searchableKeywordGroups: {
            type: SchemaType.OBJECT,
            properties: {
                highPriority: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                mediumPriority: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                },
                lowPriority: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                }
            },
            required: ['highPriority', 'mediumPriority', 'lowPriority']
        }
    },
    required: ['primaryKeywords', 'secondaryKeywords', 'conceptClusters', 'domainTerminology', 'searchableKeywordGroups']
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

Extract semantic keywords from deep text analysis
*/
async extractKeywords(
textAnalysis: DeepTextAnalysis
): Promise<SemanticExtraction> {
console.log('🔑 Starting semantic keyword extraction...');
const startTime = Date.now();

try {
  const prompt = this.buildExtractionPrompt(textAnalysis);

  const model = this.ai.getGenerativeModel({ model: getGeminiModel() });
  const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: semanticExtractionSchema,
          temperature: 0.2,
      }
  });

  const responseText = extractTextFromGeminiResponse(result);
  const extraction = parseAIJsonResponse(responseText);

  const keywordDensity = this.calculateKeywordDensity(
    textAnalysis.originalText,
    extraction.primaryKeywords
  );

  const enrichedExtraction: SemanticExtraction = {
    primaryKeywords: extraction.primaryKeywords || [],
    secondaryKeywords: extraction.secondaryKeywords || [],
    conceptClusters: extraction.conceptClusters || [],
    domainTerminology: extraction.domainTerminology,
    searchableKeywordGroups: extraction.searchableKeywordGroups,
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

Build semantic extraction prompt
*/
private buildExtractionPrompt(analysis: DeepTextAnalysis): string {
return `You are an expert in semantic analysis and information retrieval. Extract comprehensive semantic keywords from the analyzed text.

ORIGINAL TEXT:
"${analysis.originalText}"
EXTRACTED ENTITIES:
${JSON.stringify(analysis.namedEntities, null, 2)}
ATOMIC CLAIMS:
${JSON.stringify(analysis.atomicClaims, null, 2)}
YOUR TASKS:

PRIMARY KEYWORDS (5-10 keywords)

The most important concepts for fact-checking this text
Assign category: primary (main topic), secondary (supporting), contextual (background), modifier (qualifiers)
Rate relevance 0-100
Provide synonyms and related terms
Assign search weight 0-10 (10 = critical for verification)

EXAMPLES:

Text: "Biden's infrastructure bill allocated $100B to roads"
Primary Keywords:

"infrastructure bill" (primary, relevance: 95, search weight: 10, synonyms: ["infrastructure plan", "infrastructure law"])
"Biden" (primary, relevance: 90, search weight: 9)
"$100B allocation" (primary, relevance: 85, search weight: 9)




SECONDARY KEYWORDS (5-15 keywords)

Supporting concepts, modifiers, contextual information
Follow same structure as primary but with lower relevance/weight


CONCEPT CLUSTERS

Group related concepts together
Identify main concept and 3-5 related concepts
Classify domain: politics, science, health, business, technology, sports, entertainment, general
Rate specificity: broad (general topic), specific (focused area), highly-specific (niche detail)

EXAMPLE:
Main Concept: "climate change"
Related: ["global warming", "carbon emissions", "greenhouse gases", "temperature rise"]
Domain: science
Specificity: broad
DOMAIN TERMINOLOGY

Technical terms (scientific, legal, medical, etc.)
Jargon (industry-specific language)
Acronyms with expansions (GDP → Gross Domestic Product)
Domain-specific concepts


SEARCHABLE KEYWORD GROUPS

High Priority: 3-7 keywords essential for primary verification
Medium Priority: 5-10 keywords for comprehensive verification
Low Priority: 3-8 keywords for context/background



CRITICAL INSTRUCTIONS:

Focus on VERIFIABLE concepts, not opinions or sentiment
Prioritize proper nouns (people, places, organizations)
Include numeric values and dates as keywords
Generate synonyms that would appear in fact-checking sources
Consider how authoritative sources would phrase these concepts
Return ONLY valid JSON

Begin semantic extraction now.`;
}
/**

Calculate keyword density (how often keywords appear)
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

Fallback extraction when AI fails
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
