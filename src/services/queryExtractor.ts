// src/services/queryExtractor.ts

import { GoogleGenAI, Type } from "@google/genai";
// FIX: Use named imports instead of default imports
import { getGeminiApiKey, getGeminiModel } from './apiKeyService';
import { parseAIJsonResponse } from '../utils/jsonParser';

// ... (rest of your interfaces and schemas)
export interface ExtractedQueries {
  primaryQuery: string;
  subQueries: string[];
  keywords: string[];
  entities: Array<{
    name: string;
    type: 'person' | 'organization' | 'location' | 'event' | 'date' | 'concept';
  }>;
  searchPriority: 'high' | 'medium' | 'low';
}

const queryExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    primaryQuery: {
      type: Type.STRING,
      description: "Main search query optimized for fact-checking"
    },
    subQueries: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Additional targeted queries for specific claims"
    },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key searchable terms"
    },
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ['person', 'organization', 'location', 'event', 'date', 'concept']
          }
        },
        required: ['name', 'type']
      }
    },
    searchPriority: {
      type: Type.STRING,
      enum: ['high', 'medium', 'low'],
      description: "Priority level for search execution"
    }
  },
  required: ['primaryQuery', 'subQueries', 'keywords', 'entities', 'searchPriority']
};


export class QueryExtractorService {
  private static instance: QueryExtractorService;
  private ai: GoogleGenAI;

  private constructor() {
    // This assumes getGeminiApiKey() returns the key directly
    this.ai = new GoogleGenAI(getGeminiApiKey());
  }

  static getInstance(): QueryExtractorService {
    if (!QueryExtractorService.instance) {
      QueryExtractorService.instance = new QueryExtractorService();
    }
    return QueryExtractorService.instance;
  }

  async extractSearchQueries(text: string): Promise<ExtractedQueries> {
    try {
      const model = this.ai.getGenerativeModel({
          model: getGeminiModel(),
          generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              maxOutputTokens: 1500
          },
          tools: [{
            functionDeclarations: [{
              name: 'query_extraction',
              description: 'Extracts structured search queries from text.',
              parameters: queryExtractionSchema,
            }]
          }]
      });

      const prompt = `You are a search query optimization expert for fact-checking.
Analyze this text and extract optimal search queries:
"${text}"
// ... (rest of your prompt)
`;

      const result = await model.generateContent(prompt);
      const response = result.response;

      // The response from a function call is in parts
      const functionCall = response.candidates[0].content.parts[0].functionCall;
      if (functionCall.name === 'query_extraction') {
         const extracted = functionCall.args as ExtractedQueries;
         console.log('✅ Extracted Search Queries:', {
            primary: extracted.primaryQuery,
            subCount: extracted.subQueries.length,
            keywords: extracted.keywords
         });
         return extracted;
      } else {
        throw new Error("Expected function call 'query_extraction' not found in AI response.");
      }

    } catch (error) {
      console.error('Query extraction failed:', error);

      // Fallback logic remains the same
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !['that', 'this', 'with', 'from', 'have', 'been', 'were'].includes(word));
      const uniqueWords = [...new Set(words)].slice(0, 5);
      return {
        primaryQuery: uniqueWords.join(' '),
        subQueries: [],
        keywords: uniqueWords,
        entities: [],
        searchPriority: 'medium'
      };
    }
  }

  async extractTemporalQuery(text: string, date: string): Promise<string> {
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    const queries = await this.extractSearchQueries(text);
    return `${queries.primaryQuery} ${formattedDate}`;
  }
}