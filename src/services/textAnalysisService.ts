import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, getGeminiModel } from './apiKeyService';
import { RobustJSONParser } from '../utils/jsonParser';

interface TextSegmentAnalysis {
    segments: {
        text: string;
        score: number;
        justification: string;
    }[];
}

interface ContentRewrite {
    rewritten_text: string;
    changes: {
        original: string;
        revised: string;
        justification: string;
    }[];
}

export const enhancedFactCheck = async (
    claimText: string,
    method: 'gemini-only' | 'google-search' | 'hybrid' | 'citation-augmented',
    apiCall: () => Promise<any>
): Promise<any> => {
    try {
        const report = await apiCall();
        return report;
    } catch (error) {
        console.error(`Error during ${method} fact check:`, error);
        throw new Error(`Failed to execute ${method} fact check.`);
    }
};

export const analyzeTextSegments = async (text: string): Promise<TextSegmentAnalysis> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
        const model = ai.getGenerativeModel({ model: getGeminiModel() });

        const prompt = `Analyze the following text by breaking it into segments. For each segment, provide a factuality score from 0-100 and a brief justification.
        Text: "${text}"
        Respond with a JSON object: { "segments": [{ "text": "...", "score": ..., "justification": "..." }] }`;

        const result = await model.generateContent(prompt);
        const analysis = RobustJSONParser.parse(result.response.text()) as TextSegmentAnalysis;
        return analysis;
    } catch (error) {
        console.error('Error analyzing text segments:', error);
        throw new Error('Failed to analyze text segments.');
    }
};

export const rewriteContent = async (text: string): Promise<ContentRewrite> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
        const model = ai.getGenerativeModel({ model: getGeminiModel() });

        const prompt = `Rewrite the following text to improve clarity, neutrality, and factual accuracy. Identify specific changes and provide justifications.
        Text: "${text}"
        Respond with a JSON object: { "rewritten_text": "...", "changes": [{ "original": "...", "revised": "...", "justification": "..." }] }`;

        const result = await model.generateContent(prompt);
        return RobustJSONParser.parse(result.response.text()) as ContentRewrite;
    } catch (error) {
        console.error('Error rewriting content:', error);
        throw new Error('Failed to rewrite content.');
    }
};