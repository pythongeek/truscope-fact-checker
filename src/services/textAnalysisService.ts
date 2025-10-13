import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getGeminiApiKey } from './apiKeyService';
import { Segment } from '@/types';
import { parseAIJsonResponse } from '../utils/jsonParser';

export interface TextSegmentAnalysis {
    segments: Segment[];
    overallScore: number;
    analysisMethod: string;
}

export interface ContentRewrite {
    originalText: string;
    rewrittenText: string;
    changesExplanation: string;
    improvementScore: number;
    editsApplied: Array<{
        type: 'removal' | 'modification' | 'addition' | 'fact-correction';
        originalPhrase: string;
        newPhrase?: string;
        reason: string;
    }>;
}

// Schema for text segmentation analysis
const textSegmentationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        segments: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    text: { type: SchemaType.STRING, description: "A segment of the original text" },
                    score: { type: SchemaType.INTEGER, description: "Confidence score 0-100 for this segment" },
                    color: {
                        type: SchemaType.STRING,
                        enum: ['green', 'yellow', 'red', 'default'],
                        description: "Color coding based on factual confidence"
                    },
                    issues: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING },
                        description: "Specific issues found in this segment"
                    },
                    category: {
                        type: SchemaType.STRING,
                        enum: ['factual_claim', 'opinion', 'context', 'speculation', 'misleading'],
                        description: "Category of the text segment"
                    }
                },
                required: ['text', 'score', 'color']
            }
        },
        overallScore: { type: SchemaType.INTEGER, description: "Overall confidence score for the entire text" },
        analysisMethod: { type: SchemaType.STRING, description: "Method used for segmentation analysis" }
    },
    required: ['segments', 'overallScore', 'analysisMethod']
};

// Schema for content rewriting
const contentRewriteSchema = {
    type: SchemaType.OBJECT,
    properties: {
        originalText: { type: SchemaType.STRING },
        rewrittenText: { type: SchemaType.STRING, description: "The improved, fact-checked version of the text" },
        changesExplanation: { type: SchemaType.STRING, description: "Explanation of what changes were made and why" },
        improvementScore: { type: SchemaType.INTEGER, description: "Score indicating how much the content was improved (0-100)" },
        editsApplied: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    type: {
                        type: SchemaType.STRING,
                        enum: ['removal', 'modification', 'addition', 'fact-correction'],
                        description: "Type of edit applied"
                    },
                    originalPhrase: { type: SchemaType.STRING, description: "The original text that was changed" },
                    newPhrase: { type: SchemaType.STRING, description: "The new text (if applicable)", nullable: true },
                    reason: { type: SchemaType.STRING, description: "Explanation for this specific change" }
                },
                required: ['type', 'originalPhrase', 'reason']
            }
        }
    },
    required: ['originalText', 'rewrittenText', 'changesExplanation', 'improvementScore', 'editsApplied']
};

/**
 * Analyzes text and returns color-coded segments with confidence scores
 */
export const analyzeTextSegments = async (
    text: string,
    factCheckResults?: any,
    method: string = 'default'
): Promise<TextSegmentAnalysis> => {
    try {
        const apiKey = getGeminiApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);

        const prompt = `
            You are an expert fact-checking analyst. Analyze the following text and break it down into meaningful segments.

            For each segment:
            1. Assign a confidence score (0-100) based on factual accuracy
            2. Assign a color code: green (75-100), yellow (40-74), red (0-39), default (neutral content)
            3. Identify specific issues if any
            4. Categorize the type of content

            Text to analyze: "${text}"

            ${factCheckResults ? `Previous fact-check results for reference: ${JSON.stringify(factCheckResults, null, 2)}` : ''}

            Guidelines:
            - Green segments: Factually accurate, well-sourced claims
            - Yellow segments: Partially accurate but needs context or has minor issues
            - Red segments: Factually incorrect, misleading, or unsubstantiated claims
            - Default segments: Neutral content like opinions, transitions, or non-factual statements

            Break the text into logical segments (sentences or clauses) rather than individual words.

            Return your response as a JSON object matching this structure:
            {
              "segments": [{"text": "...", "score": 0-100, "color": "green|yellow|red|default", "isFact": true|false}],
              "overallScore": 0-100,
              "analysisMethod": "ai-segmentation"
            }
        `;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048
            }
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const analysis = parseAIJsonResponse(responseText) as TextSegmentAnalysis;
        
        // Ensure all segments have isFact property
        analysis.segments = analysis.segments.map(seg => ({
            ...seg,
            isFact: seg.isFact !== undefined ? seg.isFact : seg.color !== 'default'
        }));
        
        analysis.analysisMethod = method;

        return analysis;
    } catch (error) {
        console.error("Error analyzing text segments:", error);

        // Fallback: create basic segmentation
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const fallbackSegments: Segment[] = sentences.map(sentence => ({
            text: sentence.trim(),
            isFact: false,
            score: 50,
            color: 'default' as const
        }));

        return {
            segments: fallbackSegments,
            overallScore: 50,
            analysisMethod: method + ' (fallback)'
        };
    }
};

/**
 * Rewrites content based on fact-check results and user prompt
 */
export const rewriteContent = async (
    originalText: string,
    factCheckResults: any,
    textSegments: Segment[],
    userPrompt?: string
): Promise<ContentRewrite> => {
    try {
        const apiKey = getGeminiApiKey();
        const genAI = new GoogleGenerativeAI(apiKey);

        const defaultPrompt = `
            You are an expert editor and fact-checker. Your task is to rewrite the provided text to make it more accurate,
            balanced, and factually correct while maintaining the original intent and readability.

            Guidelines:
            - Remove or correct factually incorrect statements
            - Add necessary context for misleading claims
            - Preserve the original tone and style where possible
            - Ensure all claims are properly qualified
            - Remove speculation presented as fact
            - Add appropriate disclaimers where needed
        `;

        const prompt = `
            ${userPrompt || defaultPrompt}

            Original text: "${originalText}"

            Fact-check results: ${JSON.stringify(factCheckResults, null, 2)}

            Text segment analysis: ${JSON.stringify(textSegments, null, 2)}

            Based on the fact-check results and segment analysis, rewrite the content to be more accurate and balanced.
            Focus especially on the segments marked as red (low confidence) or yellow (medium confidence).

            Provide a detailed explanation of changes made and track specific edits.

            Return your response as a valid JSON object.
        `;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp",
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048
            }
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return parseAIJsonResponse(responseText) as ContentRewrite;
    } catch (error) {
        console.error("Error rewriting content:", error);
        throw new Error("Failed to rewrite content. Please try again.");
    }
};

/**
 * Enhanced fact-check method that ensures text segmentation is always included
 */
export const enhancedFactCheck = async (
    originalText: string,
    method: string,
    factCheckFunction: () => Promise<any>
): Promise<any> => {
    try {
        // Run the original fact-check
        const factCheckResult = await factCheckFunction();

        // Ensure we have text segments
        if (!factCheckResult.originalTextSegments || factCheckResult.originalTextSegments.length === 0) {
            console.log("No text segments found, generating them...");
            const segmentAnalysis = await analyzeTextSegments(originalText, factCheckResult, method);
            factCheckResult.originalTextSegments = segmentAnalysis.segments;
        }

        return factCheckResult;
    } catch (error) {
        console.error("Error in enhanced fact-check:", error);
        throw error;
    }
};
