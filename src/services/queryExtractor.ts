// src/services/queryExtractor.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiModel } from './apiKeyService';
import { parseAIJsonResponse } from '../utils/jsonParser';

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

const queryExtractionSchema: any = {
    type: SchemaType.OBJECT,
    properties: {
        primaryQuery: {
            type: SchemaType.STRING,
            description: "Main search query optimized for fact-checking"
        },
        subQueries: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Additional targeted queries for specific claims"
        },
        keywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Key searchable terms"
        },
        entities: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    type: {
                        type: SchemaType.STRING,
                        enum: ['person', 'organization', 'location', 'event', 'date', 'concept']
                    }
                },
                required: ['name', 'type']
            }
        },
        searchPriority: {
            type: SchemaType.STRING,
            enum: ['high', 'medium', 'low'],
            description: "Priority level for search execution"
        }
    },
    required: ['primaryQuery', 'subQueries', 'keywords', 'entities', 'searchPriority']
};

export class QueryExtractorService {
    private static instance: QueryExtractorService;
    private genAI: GoogleGenerativeAI;

    private constructor() {
        this.genAI = new GoogleGenerativeAI(getGeminiApiKey());
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
Keywords: ["Elon Musk", "Twitter", "acquisition", "$44 billion", "October 2022"]

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanation, markdown formatting, or text outside the JSON structure.`;

            const model = this.genAI.getGenerativeModel({ model: getGeminiModel() });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    responseSchema: queryExtractionSchema
                }
            });

            const responseText = result.response.text();

            // Try to parse the response
            let extracted: ExtractedQueries;
            try {
                // First try direct JSON parse
                extracted = JSON.parse(responseText);
            } catch {
                // If that fails, use the parseAIJsonResponse utility
                extracted = parseAIJsonResponse(responseText) as ExtractedQueries;
            }

            // Validate the extracted data
            if (!extracted.primaryQuery || !Array.isArray(extracted.subQueries)) {
                throw new Error('Invalid response structure');
            }

            console.log('✅ Extracted Search Queries:', {
                primary: extracted.primaryQuery,
                subCount: extracted.subQueries.length,
                keywords: extracted.keywords
            });

            return extracted;

        } catch (error) {
            console.error('Query extraction failed:', error);

            // Enhanced fallback: basic keyword extraction
            const words = text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3)
                .filter(word => !['that', 'this', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'there', 'about'].includes(word));

            const uniqueWords = [...new Set(words)].slice(0, 8);

            // Try to extract entities (capitalized words)
            const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || [];
            const entities = [...new Set(capitalizedWords)].slice(0, 5).map(name => ({
                name,
                type: 'concept' as const
            }));

            // Create primary query from first few unique words
            const primaryQuery = uniqueWords.slice(0, 5).join(' ');

            console.log('⚠️ Using fallback query extraction:', primaryQuery);

            return {
                primaryQuery,
                subQueries: uniqueWords.length > 5
                    ? [uniqueWords.slice(3, 6).join(' ')]
                    : [],
                keywords: uniqueWords,
                entities,
                searchPriority: 'medium'
            };
        }
    }

    async extractTemporalQuery(text: string, date: string): Promise<string> {
        try {
            // For temporal verification, create date-specific queries
            const dateObj = new Date(date);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
            });

            const queries = await this.extractSearchQueries(text);
            return `${queries.primaryQuery} ${formattedDate}`;
        } catch (error) {
            console.error('Temporal query extraction failed:', error);
            // Fallback: just use the text with date
            const words = text.split(/\s+/).slice(0, 5).join(' ');
            return `${words} ${date}`;
        }
    }
}
