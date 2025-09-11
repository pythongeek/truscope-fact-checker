import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult } from '../types';

// Simple in-memory cache (consider Redis for production)
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number }>();
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '1800000', 10); // 30 minutes
const ENABLE_CACHING = process.env.ENABLE_CACHING === 'true';

// API usage tracking
let dailyUsage = 0;
let lastResetDate = new Date().toDateString();

export const DAILY_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT || '100', 10);
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenerativeAI(API_KEY);

const checkDailyLimit = (): boolean => {
  const today = new Date().toDateString();

  if (lastResetDate !== today) {
    dailyUsage = 0;
    lastResetDate = today;
  }

  return dailyUsage < DAILY_LIMIT;
};

const generateCacheKey = (text: string): string => {
  // Create a simple hash of the input text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

const cleanCache = (): void => {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
};

export const getDailyUsage = () => {
    // a function to check the daily limit and return the current usage
    checkDailyLimit();
    return dailyUsage;
}

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  // Check daily limit
  if (!checkDailyLimit()) {
    throw new Error('Daily API usage limit reached. Please try again tomorrow.');
  }

  // Clean old cache entries
  cleanCache();

  // Check cache first
  if (ENABLE_CACHING) {
    const cacheKey = generateCacheKey(text);
    const cachedResult = analysisCache.get(cacheKey);

    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      console.log('Returning cached result');
      return cachedResult.result;
    }
  }

  // Input validation
  if (!text.trim()) {
    throw new Error('Please provide text to analyze.');
  }

  if (text.length > 10000) {
    throw new Error('Text is too long. Please limit to 10,000 characters.');
  }

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
---`;

  try {
    // Increment usage counter
    dailyUsage++;

    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash"});
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let jsonString = text.trim();
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

    // Validate the structure
    if (
      typeof parsedResult.overallScore !== 'number' ||
      typeof parsedResult.summary !== 'string' ||
      !Array.isArray(parsedResult.claims)
    ) {
      throw new Error('The AI returned a response with a missing or invalid structure. Please try again.');
    }

    const finalResult = parsedResult as AnalysisResult;

    // Cache the result
    if (ENABLE_CACHING) {
      const cacheKey = generateCacheKey(text);
      analysisCache.set(cacheKey, {
        result: finalResult,
        timestamp: Date.now()
      });
    }

    return finalResult;

  } catch (error) {
    console.error("Error calling Gemini API:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('SAFETY')) {
        throw new Error('The provided content could not be analyzed as it violates safety guidelines. Please submit different text.');
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
        throw new Error('API usage limit reached. Please try again later.');
      }
      if (error.message.includes('429')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      throw error;
    }

    throw new Error('An unexpected error occurred while communicating with the AI service. Please check your connection and try again.');
  }
};