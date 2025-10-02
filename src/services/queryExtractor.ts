// src/services/queryExtractor.ts

import { GoogleGenAI, Type } from "@google/genai"; // Make sure 'Type' is imported
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

// --- START OF FIX ---
// The schema now uses the 'Type' enum from the @google/genai SDK instead of strings.
const queryExtractionSchema = {
    type: Type.OBJECT,
    properties: {
        primaryQuery: {
            type: Type.STRING,
            description: "A concise, high-level search query summarizing the core claim or topic.",
        },
        subQueries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of secondary, more specific questions to verify individual facts.",
        },
        keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of essential single or two-word keywords from the text.",
        },
        entities: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['person', 'organization', 'location', 'event', 'date', 'concept'] },
                },
                required: ['name', 'type'],
            },
            description: "A list of named entities (people, places, organizations).",
        },
        searchPriority: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
            description: "The urgency or importance of fact-checking this claim.",
        },
    },
    required: ["primaryQuery", "subQueries", "keywords", "entities", "searchPriority"],
};
// --- END OF FIX ---

export class QueryExtractorService {
    private static instance: QueryExtractorService;
    private ai: GoogleGenAI;

    private constructor() {
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
                        // The corrected schema is used here
                        parameters: queryExtractionSchema,
                    }]
                }]
            });

            const prompt = `You are a search query optimization expert for fact-checking. Analyze this text and extract optimal search queries: "${text}"`;

            const result = await model.generateContent(prompt);
            const response = result.response;

            if (response.candidates && response.candidates[0].content.parts[0].functionCall) {
                const functionCall = response.candidates[0].content.parts[0].functionCall;
                if (functionCall.name === 'query_extraction') {
                    const extracted = functionCall.args as ExtractedQueries;
                    console.log('✅ Extracted Search Queries:', {
                        primary: extracted.primaryQuery,
                        subCount: extracted.subQueries.length,
                        keywords: extracted.keywords
                    });
                    return extracted;
                }
            }
            throw new Error("Expected function call 'query_extraction' not found in AI response.");

        } catch (error) {
            console.error('Query extraction failed:', error);

            // Fallback logic
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
        const formattedDate = dateObj.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long'
        });

        const queries = await this.extractSearchQueries(text);
        return `${queries.primaryQuery} ${formattedDate}`;
    }
}
