// src/services/queryExtractor.ts

import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiApiKey, getGeminiModel } from './apiKeyService';
import { geminiService } from './geminiService';
import { jsonParser, parseAIJsonResponse } from '../utils/jsonParser';

// --- NEW INTERFACE ---
export interface ExtractedSearchTerms {
  primaryQuery: string; // A short, summary query (e.g., "Sheff G prison sentence details")
  keywords: string[]; // A list of key terms (e.g., ["Sheff G", "attempted murder", "plea deal"])
}

// --- EXISTING INTERFACE (Kept for compatibility) ---
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


class QueryExtractor {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }

  // --- NEW FUNCTION ---
  // This function will be called ONCE before the tiered process starts.
  async generateSearchTermsFromText(text: string): Promise<ExtractedSearchTerms> {
    console.log('⚡️ Generating optimized search terms from text...');
    const prompt = `
      Analyze the following text and extract the most critical information to be used for fact-checking.
      Provide a primary search query that is a short, human-readable question or phrase summarizing the core topic. This query MUST be less than 80 characters.
      Also, provide an array of essential keywords.

      Respond ONLY with a valid, minified JSON object in the following format:
      {"primaryQuery": "example query", "keywords": ["keyword1", "keyword2", "keyword3"]}

      Text to analyze:
      ---
      ${text}
      ---
    `;

    try {
      const response = await geminiService.generateText(prompt);
      const parsed = jsonParser.parse<ExtractedSearchTerms>(response);
      console.log('✅ Generated Search Terms:', parsed);
      return parsed;
    } catch (error) {
      console.error('💥 Failed to generate search terms:', error);
      // Fallback in case of failure: create a very basic query
      return {
        primaryQuery: text.substring(0, 80).split(' ').slice(0, 5).join(' '),
        keywords: text.substring(0, 200).split(' '),
      };
    }
  }

  // --- EXISTING FUNCTION (Kept as requested) ---
  async extractSearchQueries(text: string): Promise<ExtractedQueries> {
    try {
      const prompt = `You are a search query optimization expert for fact-checking.

Analyze this text and extract optimal search queries:
"${text}"

Generate:
1. **Primary Query**: The most important search query to verify the main claim (20-60 characters, focused)
2. **Sub-Queries**: 2-4 additional queries for specific sub-claims or details
3. **Keywords**: 5-10 key searchable terms
4. **Entities**: Identify people, organizations, locations, events, dates, concepts
5. **Search Priority**: Rate the urgency (high for breaking news, low for historical facts)

IMPORTANT:
- Queries should be concise and searchable (not full sentences)
- Focus on verifiable facts, not opinions
- Include specific names, dates, locations when present
- Prioritize queries that will find authoritative sources

Examples:
Text: "Elon Musk bought Twitter for $44 billion in October 2022"
Primary: "Elon Musk Twitter acquisition 2022 price"
Sub-Queries: ["Twitter deal $44 billion", "Elon Musk Twitter October 2022"]
Keywords: ["Elon Musk", "Twitter", "acquisition", "$44 billion", "October 2022"]`;

      const result = await this.ai.models.generateContent({
        model: getGeminiModel(),
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: queryExtractionSchema,
          temperature: 0.3,
          maxOutputTokens: 1500
        }
      });

      const extracted = parseAIJsonResponse(result.text) as ExtractedQueries;

      console.log('✅ Extracted Search Queries:', {
        primary: extracted.primaryQuery,
        subCount: extracted.subQueries.length,
        keywords: extracted.keywords
      });

      return extracted;

    } catch (error) {
      console.error('Query extraction failed:', error);

      // Fallback: basic keyword extraction
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['that', 'this', 'with', 'from', 'have', 'been', 'were'].includes(word));

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
    // For temporal verification, create date-specific queries
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });

    const queries = await this.extractSearchQueries(text);
    return `${queries.primaryQuery} ${formattedDate}`;
  }
}

export const queryExtractor = new QueryExtractor();
