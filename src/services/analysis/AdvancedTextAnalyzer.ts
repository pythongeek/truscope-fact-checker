// src/services/analysis/AdvancedTextAnalyzer.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiModel } from '../apiKeyService';
import { parseAIJsonResponse } from '../../utils/jsonParser';
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

export interface NamedEntity {
text: string;
type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT' | 'DATE' | 'CONCEPT' | 'PRODUCT' | 'MONEY';
relevance: number; // 0-100
aliases?: string[];
context?: string;
}
export interface AtomicClaim {
id: string;
claimText: string;
claimType: 'factual' | 'statistical' | 'causal' | 'temporal' | 'comparative' | 'opinion';
verifiability: 'high' | 'medium' | 'low';
entities: string[];
temporalContext?: TemporalContext;
dependencies: string[]; // IDs of related claims
priority: number; // 1-10 (10 = highest)
}
export interface TemporalContext {
hasDateReference: boolean;
dateType: 'specific' | 'relative' | 'range' | 'ongoing' | 'future';
extractedDates: string[];
temporalModifiers: string[];
timeframe?: string;
recency: 'breaking' | 'recent' | 'historical' | 'timeless';
}
export interface BiasIndicators {
overallBiasScore: number; // 0-100 (0 = neutral, 100 = highly biased)
sentimentPolarity: 'positive' | 'negative' | 'neutral' | 'mixed';
languageMarkers: {
emotionalLanguage: string[];
absoluteStatements: string[];
hedgingLanguage: string[];
loadedTerms: string[];
};
sourceBias?: 'left' | 'center' | 'right' | 'unknown';
}
export interface DeepTextAnalysis {
originalText: string;
namedEntities: NamedEntity[];
atomicClaims: AtomicClaim[];
temporalContext: TemporalContext;
biasIndicators: BiasIndicators;
complexity: 'simple' | 'moderate' | 'complex';
suggestedSearchDepth: 'shallow' | 'standard' | 'deep';
metadata: {
wordCount: number;
sentenceCount: number;
processingTimestamp: string;
};
}
// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================
const namedEntitySchema = {
    type: "object",
    properties: {
        text: { type: "string", description: "The entity text" },
        type: {
            type: "string",
            enum: ['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT', 'DATE', 'CONCEPT', 'PRODUCT', 'MONEY'],
            description: "Entity type"
        },
        relevance: { type: "integer", description: "Relevance score 0-100" },
        aliases: {
            type: "array",
            items: { type: "string" },
            nullable: true,
            description: "Alternative names or spellings"
        },
        context: {
            type: "string",
            nullable: true,
            description: "Brief context about the entity"
        }
    },
    required: ['text', 'type', 'relevance']
};
const atomicClaimSchema = {
    type: "object",
    properties: {
        id: { type: "string", description: "Unique claim identifier" },
        claimText: { type: "string", description: "The atomic claim statement" },
        claimType: {
            type: "string",
            enum: ['factual', 'statistical', 'causal', 'temporal', 'comparative', 'opinion'],
            description: "Type of claim"
        },
        verifiability: {
            type: "string",
            enum: ['high', 'medium', 'low'],
            description: "How verifiable this claim is"
        },
        entities: {
            type: "array",
            items: { type: "string" },
            description: "Entities referenced in this claim"
        },
        temporalContext: {
            type: "object",
            nullable: true,
            properties: {
                hasDateReference: { type: "boolean" },
                dateType: {
                    type: "string",
                    enum: ['specific', 'relative', 'range', 'ongoing', 'future']
                },
                extractedDates: {
                    type: "array",
                    items: { type: "string" }
                },
                temporalModifiers: {
                    type: "array",
                    items: { type: "string" }
                },
                timeframe: { type: "string", nullable: true },
                recency: {
                    type: "string",
                    enum: ['breaking', 'recent', 'historical', 'timeless']
                }
            },
            required: ['hasDateReference', 'dateType', 'extractedDates', 'temporalModifiers', 'recency']
        },
        dependencies: {
            type: "array",
            items: { type: "string" },
            description: "IDs of claims this depends on"
        },
        priority: {
            type: "integer",
            description: "Priority for verification (1-10)"
        }
    },
    required: ['id', 'claimText', 'claimType', 'verifiability', 'entities', 'dependencies', 'priority']
};
const deepTextAnalysisSchema = {
    type: "object",
    properties: {
        namedEntities: {
            type: "array",
            items: namedEntitySchema
        },
        atomicClaims: {
            type: "array",
            items: atomicClaimSchema
        },
        temporalContext: {
            type: "object",
            properties: {
                hasDateReference: { type: "boolean" },
                dateType: {
                    type: "string",
                    enum: ['specific', 'relative', 'range', 'ongoing', 'future']
                },
                extractedDates: {
                    type: "array",
                    items: { type: "string" }
                },
                temporalModifiers: {
                    type: "array",
                    items: { type: "string" }
                },
                timeframe: { type: "string", nullable: true },
                recency: {
                    type: "string",
                    enum: ['breaking', 'recent', 'historical', 'timeless']
                }
            },
            required: ['hasDateReference', 'dateType', 'extractedDates', 'temporalModifiers', 'recency']
        },
        biasIndicators: {
            type: "object",
            properties: {
                overallBiasScore: { type: "integer" },
                sentimentPolarity: {
                    type: "string",
                    enum: ['positive', 'negative', 'neutral', 'mixed']
                },
                languageMarkers: {
                    type: "object",
                    properties: {
                        emotionalLanguage: { type: "array", items: { type: "string" } },
                        absoluteStatements: { type: "array", items: { type: "string" } },
                        hedgingLanguage: { type: "array", items: { type: "string" } },
                        loadedTerms: { type: "array", items: { type: "string" } }
                    },
                    required: ['emotionalLanguage', 'absoluteStatements', 'hedgingLanguage', 'loadedTerms']
                },
                sourceBias: {
                    type: "string",
                    enum: ['left', 'center', 'right', 'unknown'],
                    nullable: true
                }
            },
            required: ['overallBiasScore', 'sentimentPolarity', 'languageMarkers']
        },
        complexity: {
            type: "string",
            enum: ['simple', 'moderate', 'complex']
        },
        suggestedSearchDepth: {
            type: "string",
            enum: ['shallow', 'standard', 'deep']
        }
    },
    required: ['namedEntities', 'atomicClaims', 'temporalContext', 'biasIndicators', 'complexity', 'suggestedSearchDepth']
};
// ============================================================================
// SERVICE CLASS
// ============================================================================
export class AdvancedTextAnalyzer {
    private static instance: AdvancedTextAnalyzer;
    private ai: GoogleGenerativeAI;
    private constructor() {
        this.ai = new GoogleGenerativeAI(getGeminiApiKey());
    }
    static getInstance(): AdvancedTextAnalyzer {
        if (!AdvancedTextAnalyzer.instance) {
            AdvancedTextAnalyzer.instance = new AdvancedTextAnalyzer();
        }
        return AdvancedTextAnalyzer.instance;
    }
    /**

    Main analysis method - performs deep text analysis
    */
    async analyzeText(text: string): Promise<DeepTextAnalysis> {
        console.log('🔬 Starting deep text analysis...');
        const startTime = Date.now();

        try {
            const prompt = this.buildAnalysisPrompt(text);

            const model = this.ai.getGenerativeModel({ model: getGeminiModel() });
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: deepTextAnalysisSchema,
                    temperature: 0.1,
                }
            });

            const responseText = extractTextFromGeminiResponse(result);
            const analysis = parseAIJsonResponse(responseText);

            const enrichedAnalysis: DeepTextAnalysis = {
                originalText: text,
    namedEntities: analysis.namedEntities || [],
    atomicClaims: analysis.atomicClaims || [],
    temporalContext: analysis.temporalContext,
    biasIndicators: analysis.biasIndicators,
    complexity: analysis.complexity,
    suggestedSearchDepth: analysis.suggestedSearchDepth,
    metadata: {
      wordCount: text.split(/\s+/).length,
      sentenceCount: text.split(/[.!?]+/).length,
      processingTimestamp: new Date().toISOString()
    }
  };

  const processingTime = Date.now() - startTime;
  console.log(`✅ Deep text analysis completed in ${processingTime}ms`);
  console.log(`   - Entities: ${enrichedAnalysis.namedEntities.length}`);
  console.log(`   - Claims: ${enrichedAnalysis.atomicClaims.length}`);
  console.log(`   - Complexity: ${enrichedAnalysis.complexity}`);

  return enrichedAnalysis;

} catch (error) {
  console.error('❌ Deep text analysis failed:', error);
  return this.generateFallbackAnalysis(text);
}
}
/**

Build the comprehensive analysis prompt
*/
private buildAnalysisPrompt(text: string): string {
return `You are an expert fact-checking analyst with advanced NLP capabilities. Perform a comprehensive deep analysis of the following text.

TEXT TO ANALYZE:
"${text}"
YOUR TASKS:

NAMED ENTITY RECOGNITION (NER)

Extract all significant entities: people, organizations, locations, events, dates, concepts, products, monetary values
For each entity:

Assign relevance score (0-100): How central is this entity to the claim?
Provide aliases (alternative names/spellings)
Add brief context if needed




CLAIM DECOMPOSITION

Break down the text into atomic claims (smallest verifiable units)
For each atomic claim:

Assign unique ID (claim-1, claim-2, etc.)
Classify type: factual, statistical, causal, temporal, comparative, or opinion
Rate verifiability: high (easily verifiable), medium (needs context), low (subjective/vague)
List entities referenced in this specific claim
Extract temporal context if present
Identify dependencies (claims that depend on other claims being true)
Assign priority (1-10): Higher priority for central, controversial, or impactful claims



CLAIM DECOMPOSITION EXAMPLES:

"President Biden, who was elected in 2020, announced a new policy yesterday."
→ Claim 1: "Biden was elected president in 2020" (factual, high verifiability, priority: 5)
→ Claim 2: "Biden announced a new policy yesterday" (temporal, high verifiability, priority: 8)
"The economy is improving because unemployment dropped 2% last month."
→ Claim 1: "Unemployment dropped 2% last month" (statistical, high verifiability, priority: 9)
→ Claim 2: "The economy is improving" (opinion, low verifiability, priority: 4, depends on claim-1)


TEMPORAL CONTEXT EXTRACTION

Determine if text has date/time references
Classify date type: specific (exact dates), relative (yesterday, last month), range (2020-2023), ongoing (currently), future
Extract all date mentions
Identify temporal modifiers (recently, historically, soon, etc.)
Determine recency: breaking (<24hrs), recent (<30 days), historical (>1 year), timeless


SENTIMENT & BIAS DETECTION

Calculate overall bias score (0=neutral, 100=highly biased)
Determine sentiment polarity: positive, negative, neutral, mixed
Identify language markers:

Emotional language (shocking, devastating, amazing)
Absolute statements (always, never, everyone)
Hedging language (might, could, possibly)
Loaded terms (radical, mainstream, extremist)


Attempt to detect political/ideological bias if apparent


COMPLEXITY & SEARCH DEPTH ASSESSMENT

Rate complexity: simple (1-2 claims), moderate (3-5 claims), complex (6+ claims)
Suggest search depth:

shallow: Simple factual claims, well-known facts
standard: Most claims, requires typical verification
deep: Complex claims, controversial topics, multiple interdependent claims





CRITICAL INSTRUCTIONS:

Be thorough but precise
Don't make assumptions; only extract what's explicitly stated or strongly implied
For opinions, mark them as such but still decompose for context
Prioritize claims that are central to the text's main argument
Return ONLY valid JSON matching the exact schema provided

Begin analysis now.`;
}
/**

Fallback analysis when AI fails
*/
private generateFallbackAnalysis(text: string): DeepTextAnalysis {
console.warn('⚠️ Using fallback analysis method');

const words = text.split(/\s+/);
const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

// Basic entity extraction (capitalize words as potential entities)
const potentialEntities = words
  .filter(word => /^[A-Z]/.test(word) && word.length > 2)
  .filter((word, index, arr) => arr.indexOf(word) === index)
  .slice(0, 10);

const entities: NamedEntity[] = potentialEntities.map(entity => ({
  text: entity,
  type: 'CONCEPT' as const,
  relevance: 50,
  aliases: []
}));

// Basic claim decomposition (one claim per sentence)
const claims: AtomicClaim[] = sentences.map((sentence, index) => ({
  id: `claim-${index + 1}`,
  claimText: sentence.trim(),
  claimType: 'factual' as const,
  verifiability: 'medium' as const,
  entities: [],
  dependencies: [],
  priority: 5
}));

// Basic temporal detection
const hasDate = /\d{4}|yesterday|today|tomorrow|last\s+\w+|next\s+\w+/i.test(text);
const temporalContext: TemporalContext = {
  hasDateReference: hasDate,
  dateType: hasDate ? 'relative' : 'ongoing',
  extractedDates: [],
  temporalModifiers: [],
  recency: 'timeless'
};

return {
  originalText: text,
  namedEntities: entities,
  atomicClaims: claims,
  temporalContext,
  biasIndicators: {
    overallBiasScore: 50,
    sentimentPolarity: 'neutral',
    languageMarkers: {
      emotionalLanguage: [],
      absoluteStatements: [],
      hedgingLanguage: [],
      loadedTerms: []
    }
  },
  complexity: claims.length > 5 ? 'complex' : claims.length > 2 ? 'moderate' : 'simple',
  suggestedSearchDepth: 'standard',
  metadata: {
    wordCount: words.length,
    sentenceCount: sentences.length,
    processingTimestamp: new Date().toISOString()
  }
};
}
}
