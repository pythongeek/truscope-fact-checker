import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export interface NamedEntity {
  text: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'EVENT' | 'OTHER';
  relevance: number;
  aliases?: string[];
  context?: string;
}

export interface AtomicClaim {
  claim: string;
  confidence: number;
  claimType: 'factual' | 'opinion' | 'prediction' | 'statistical';
  subjects: string[];
  temporalContext?: string;
}

export interface TemporalContext {
  timeReference: string;
  type: 'absolute' | 'relative' | 'implicit';
  timestamp?: string;
  confidence: number;
}

export interface BiasIndicator {
  type: 'political' | 'emotional' | 'selective' | 'framing' | 'none';
  severity: 'low' | 'medium' | 'high';
  evidence: string;
  confidence: number;
}

export interface DeepTextAnalysis {
  namedEntities: NamedEntity[];
  atomicClaims: AtomicClaim[];
  temporalContexts: TemporalContext[];
  biasIndicators: BiasIndicator[];
  overallSentiment: {
    polarity: 'positive' | 'negative' | 'neutral';
    intensity: number;
  };
  suggestedSearchDepth: 'shallow' | 'moderate' | 'deep';
}

export class AdvancedTextAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey?: string) {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!key) {
      throw new Error('Gemini API key not found. Please set VITE_GEMINI_API_KEY environment variable.');
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    });
  }

  async analyzeText(text: string): Promise<DeepTextAnalysis> {
    try {
      const result = await this.model.generateContent({
        contents: [{
          role: "user",
          parts: [{
            text: `Perform a comprehensive analysis of the following text. Extract named entities, break down into atomic claims, identify temporal contexts, detect bias, and assess sentiment.

Text to analyze:
"""
${text}
"""

Provide a thorough analysis following the required schema.`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              namedEntities: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    text: { 
                      type: SchemaType.STRING, 
                      description: "The entity text" 
                    },
                    type: { 
                      type: SchemaType.STRING, 
                      enum: ['PERSON', 'ORGANIZATION', 'LOCATION', 'DATE', 'EVENT', 'OTHER'],
                      description: "Entity type" 
                    },
                    relevance: { 
                      type: SchemaType.NUMBER, 
                      description: "Relevance score 0-100" 
                    },
                    aliases: { 
                      type: SchemaType.ARRAY,
                      items: { type: SchemaType.STRING },
                      description: "Alternative names",
                      nullable: true
                    },
                    context: { 
                      type: SchemaType.STRING, 
                      description: "Contextual information",
                      nullable: true
                    }
                  },
                  required: ['text', 'type', 'relevance']
                }
              },
              atomicClaims: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    claim: { type: SchemaType.STRING },
                    confidence: { type: SchemaType.NUMBER },
                    claimType: { 
                      type: SchemaType.STRING,
                      enum: ['factual', 'opinion', 'prediction', 'statistical']
                    },
                    subjects: { 
                      type: SchemaType.ARRAY,
                      items: { type: SchemaType.STRING }
                    },
                    temporalContext: { 
                      type: SchemaType.STRING,
                      nullable: true
                    }
                  },
                  required: ['claim', 'confidence', 'claimType', 'subjects']
                }
              },
              temporalContexts: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    timeReference: { type: SchemaType.STRING },
                    type: { 
                      type: SchemaType.STRING,
                      enum: ['absolute', 'relative', 'implicit']
                    },
                    timestamp: { 
                      type: SchemaType.STRING,
                      nullable: true
                    },
                    confidence: { type: SchemaType.NUMBER }
                  },
                  required: ['timeReference', 'type', 'confidence']
                }
              },
              biasIndicators: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    type: { 
                      type: SchemaType.STRING,
                      enum: ['political', 'emotional', 'selective', 'framing', 'none']
                    },
                    severity: { 
                      type: SchemaType.STRING,
                      enum: ['low', 'medium', 'high']
                    },
                    evidence: { type: SchemaType.STRING },
                    confidence: { type: SchemaType.NUMBER }
                  },
                  required: ['type', 'severity', 'evidence', 'confidence']
                }
              },
              overallSentiment: {
                type: SchemaType.OBJECT,
                properties: {
                  polarity: { 
                    type: SchemaType.STRING,
                    enum: ['positive', 'negative', 'neutral']
                  },
                  intensity: { type: SchemaType.NUMBER }
                },
                required: ['polarity', 'intensity']
              },
              suggestedSearchDepth: {
                type: SchemaType.STRING,
                enum: ['shallow', 'moderate', 'deep']
              }
            },
            required: ['namedEntities', 'atomicClaims', 'temporalContexts', 'biasIndicators', 'overallSentiment', 'suggestedSearchDepth']
          }
        }
      });

      const response = await result.response;
      const analysisData = JSON.parse(response.text());

      return analysisData as DeepTextAnalysis;

    } catch (error) {
      console.error('Advanced text analysis failed:', error);
      
      // Fallback: return basic analysis
      return this.fallbackAnalysis(text);
    }
  }

  private fallbackAnalysis(text: string): DeepTextAnalysis {
    // Simple fallback when AI analysis fails
    return {
      namedEntities: [],
      atomicClaims: [{
        claim: text,
        confidence: 50,
        claimType: 'factual',
        subjects: ['unknown']
      }],
      temporalContexts: [],
      biasIndicators: [{
        type: 'none',
        severity: 'low',
        evidence: 'Fallback analysis - no AI processing',
        confidence: 0
      }],
      overallSentiment: {
        polarity: 'neutral',
        intensity: 50
      },
      suggestedSearchDepth: 'moderate'
    };
  }

  // Additional utility methods
  async extractEntities(text: string): Promise<NamedEntity[]> {
    const analysis = await this.analyzeText(text);
    return analysis.namedEntities;
  }

  async decomposeIntoClaims(text: string): Promise<AtomicClaim[]> {
    const analysis = await this.analyzeText(text);
    return analysis.atomicClaims;
  }

  async detectBias(text: string): Promise<BiasIndicator[]> {
    const analysis = await this.analyzeText(text);
    return analysis.biasIndicators;
  }
}
