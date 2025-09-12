import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult } from '../types';

// Simple in-memory cache (consider Redis for production)
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number }>();
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '1800000', 10); // 30 minutes
const ENABLE_CACHING = process.env.ENABLE_CACHING === 'true';

// API usage tracking (only for shared API key)
let dailyUsage = 0;
let lastResetDate = new Date().toDateString();

export const DAILY_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT || '100', 10);
const SHARED_API_KEY = process.env.GEMINI_API_KEY;

const getUserApiKey = (): string | null => {
  try {
    return localStorage.getItem('gemini_api_key');
  } catch {
    return null;
  }
};

const getApiKey = (): string => {
  const userApiKey = getUserApiKey();
  if (userApiKey) {
    return userApiKey;
  }

  if (!SHARED_API_KEY) {
    throw new Error("No API key available. Please add your own Gemini API key to continue.");
  }

  return SHARED_API_KEY;
};

const isUsingSharedKey = (): boolean => {
  return !getUserApiKey();
};

const checkDailyLimit = (): boolean => {
  // Only check limits for shared API key usage
  if (!isUsingSharedKey()) {
    return true; // No limits for user's own API key
  }

  const today = new Date().toDateString();

  if (lastResetDate !== today) {
    dailyUsage = 0;
    lastResetDate = today;
  }

  return dailyUsage < DAILY_LIMIT;
};

const generateCacheKey = (text: string, apiKeyHash: string): string => {
  // Create a simple hash of the input text and API key
  let hash = 0;
  const combined = text + apiKeyHash;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

const hashApiKey = (apiKey: string): string => {
  // Create a simple hash of the API key for cache key generation
  let hash = 0;
  for (let i = 0; i < Math.min(apiKey.length, 20); i++) {
    const char = apiKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
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

export const getDailyUsage = (): number => {
  // Only return usage for shared API key
  if (!isUsingSharedKey()) {
    return 0; // No usage tracking for user's own API key
  }

  checkDailyLimit();
  return dailyUsage;
};

export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
  let apiKey: string;

  try {
    apiKey = getApiKey();
  } catch (error) {
    throw error; // This will trigger the API key modal
  }

  const usingSharedKey = isUsingSharedKey();

  // Check daily limit only for shared API key
  if (usingSharedKey && !checkDailyLimit()) {
    throw new Error('Daily API usage limit reached. Please add your own API key for unlimited usage or try again tomorrow.');
  }

  // Clean old cache entries
  cleanCache();

  // Check cache first
  if (ENABLE_CACHING) {
    const apiKeyHash = hashApiKey(apiKey);
    const cacheKey = generateCacheKey(text, apiKeyHash);
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
    // Increment usage counter only for shared API key
    if (usingSharedKey) {
      dailyUsage++;
    }

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash"});
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    let jsonString = responseText.trim();
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
      const apiKeyHash = hashApiKey(apiKey);
      const cacheKey = generateCacheKey(text, apiKeyHash);
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
      if (error.message.includes('API key not valid') || error.message.includes('API_KEY_INVALID')) {
        throw new Error('Invalid API key. Please check your API key and try again.');
      }
      if (error.message.includes('SAFETY')) {
        throw new Error('The provided content could not be analyzed as it violates safety guidelines. Please submit different text.');
      }
      if (error.message.includes('quota') || error.message.includes('limit')) {
        if (usingSharedKey) {
          throw new Error('API usage limit reached. Please add your own API key for unlimited usage.');
        } else {
          throw new Error('Your API key has reached its quota limit. Please check your Google Cloud console.');
        }
      }
      if (error.message.includes('429')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      if (error.message.includes('403')) {
        throw new Error('API access forbidden. Please check your API key permissions in Google Cloud Console.');
      }
      throw error;
    }

    throw new Error('An unexpected error occurred while communicating with the AI service. Please check your connection and try again.');
  }
};

import { SearchOrchestrator } from './verification/searchOrchestrator';
import { VerificationResult } from '../types/verification';

// Define a placeholder for the new type
export interface EnhancedAnalysisResult extends AnalysisResult {
  verification_results: VerificationResult[] | null;
  enhanced_credibility_score?: number;
}

// Placeholder for a function that doesn't exist yet.
const calculateEnhancedCredibility = (
  baseScore: number,
  verificationResults: VerificationResult[]
): number => {
  if (!verificationResults || verificationResults.length === 0) {
    return baseScore;
  }
  const verificationScore = verificationResults.reduce((acc, r) => acc + r.confidence_score, 0) / verificationResults.length;
  return (baseScore + verificationScore) / 2;
};

// Placeholder for a function that doesn't exist yet.
const executeGeminiQuery = async (prompt: string): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

// Placeholder for a function that doesn't exist yet.
const parseQueryArray = (result: string): string[] => {
  try {
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(result);
  } catch (error) {
    console.error("Failed to parse query array:", error);
    return [];
  }
};

export const analyzeContentWithVerification = async (
  text: string,
  enableVerification: boolean = false
): Promise<EnhancedAnalysisResult> => {

  const baseResult = await analyzeContent(text);

  if (!enableVerification) {
    return { ...baseResult, verification_results: null };
  }

  // Initialize verification orchestrator
  const apiKey = getApiKey();
  const ai = new GoogleGenerativeAI(apiKey);
  const searchOrchestrator = new SearchOrchestrator(ai);

  // Verify each claim with real-time progress
  const verificationPromises = baseResult.claims.map(async claim => {
    return await searchOrchestrator.verifyClaimWithSources(claim.claim);
  });

  const verificationResults = await Promise.all(verificationPromises);

  return {
    ...baseResult,
    verification_results: verificationResults,
    enhanced_credibility_score: calculateEnhancedCredibility(
      baseResult.overallScore,
      verificationResults
    )
  };
};

// New function for strategic search query generation
export const generateStrategicQueries = async (claim: string): Promise<string[]> => {
  const prompt = `
Generate 8-10 strategic search queries for fact-checking this claim: "${claim}"

Create queries that would find:
1. Official/government sources and data
2. Academic research and peer-reviewed studies
3. News coverage from major outlets
4. Expert commentary and analysis
5. Historical context and background
6. Recent updates or changes
7. Contradictory viewpoints or criticism
8. Primary source materials (documents, transcripts, etc.)

Make queries specific, using precise terminology and relevant keywords.
Avoid generic terms. Focus on finding authoritative, verifiable sources.

Return as a JSON array of search query strings.
  `;

  const result = await executeGeminiQuery(prompt);
  return parseQueryArray(result);
};