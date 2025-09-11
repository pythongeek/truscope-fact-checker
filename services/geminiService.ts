import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  const prompt = `You are an expert fact-checker and critical analyst. Your task is to analyze the following text, identify the main factual claims, and evaluate their credibility. Use Google Search to find supporting or contradicting evidence from reliable sources to improve the accuracy of your claims verification.

Provide an overall credibility score from 0 to 100, where 100 is completely credible. Also, provide a brief summary of your analysis. For each claim you identify, state the claim, classify its status as 'Verified', 'Uncertain', or 'False', and provide a concise explanation for your reasoning, citing web sources if available.

IMPORTANT: Your response must be a single, valid JSON object. Do not include any text, markdown formatting like \`\`\`json, or any explanations outside of this JSON object. The JSON object must conform to the following structure:
{
  "overallScore": number (0-100),
  "summary": string,
  "claims": [
    {
      "claim": string,
      "status": "Verified" | "Uncertain" | "False",
      "explanation": string
    }
  ]
}

Text to analyze:
---
${text}
---
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        temperature: 0.1,
      }
    });

    let jsonString = response.text.trim();
    // The response can be wrapped in markdown, so we extract the JSON part.
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1];
    }

    let parsedResult;
    try {
        parsedResult = JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON response:", jsonString);
        throw new Error('The AI returned a response in an unexpected format. Please try again or rephrase your text.');
    }

    // Validate the structure to match AnalysisResult
    if (
      typeof parsedResult.overallScore !== 'number' ||
      typeof parsedResult.summary !== 'string' ||
      !Array.isArray(parsedResult.claims)
    ) {
      throw new Error('The AI returned a response with a missing or invalid structure. Please try again.');
    }

    const finalResult = parsedResult as AnalysisResult;

    // Extract and de-duplicate sources from grounding metadata
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      const uniqueSources = new Map<string, { uri: string; title: string }>();
      groundingMetadata.groundingChunks
        .filter(chunk => chunk.web && chunk.web.uri)
        .forEach(chunk => {
            if (chunk.web) {
                uniqueSources.set(chunk.web.uri, {
                    uri: chunk.web.uri,
                    title: chunk.web.title || chunk.web.uri,
                });
            }
        });
      finalResult.sources = Array.from(uniqueSources.values());
    }

    return finalResult;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if(error instanceof Error && error.message.includes('SAFETY')) {
        throw new Error('The provided content could not be analyzed as it violates safety guidelines. Please submit different text.');
    }
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unexpected error occurred while communicating with the AI service. Please check your connection and try again.');
  }
};