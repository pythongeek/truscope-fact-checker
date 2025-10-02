import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiApiKey, getGeminiModel } from './apiKeyService';
import { RobustJSONParser } from '../utils/jsonParser';

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
    this.ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }

  static getInstance(): QueryExtractorService {
    if (!QueryExtractorService.instance) {
      QueryExtractorService.instance = new QueryExtractorService();
    }
    return QueryExtractorService.instance;
  }

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

      const extracted = RobustJSONParser.parse(result.response.text()) as ExtractedQueries;

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