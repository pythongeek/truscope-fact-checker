import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult } from '../types';
import type { VerificationResult } from '../types/verification';
import { SearchOrchestrator } from './verification/searchOrchestrator';

// --- Caching Configuration ---
const DEFAULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const ENABLE_CACHING = process.env.NODE_ENV !== 'development';

// Simple in-memory caches (consider Redis for production)
const queryCache = new Map<string, { response: string; timestamp: number }>();
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number }>();

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

const cleanCaches = (): void => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > DEFAULT_CACHE_TTL) {
      queryCache.delete(key);
    }
  }
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > DEFAULT_CACHE_TTL) {
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

/**
 * Analyzes a piece of content to identify factual claims and assess credibility.
 * Note: This function is separate from the main verification workflow and has its own cache.
 */
export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
    // This function remains for other potential uses, but is not part of the main orchestrator flow.
    checkDailyLimit();
    cleanCaches();

    if (ENABLE_CACHING) {
        const cacheKey = generateCacheKey(`analyze:${text}`);
        const cached = analysisCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < DEFAULT_CACHE_TTL)) {
            return cached.result;
        }
    }

    const prompt = `You are an expert fact-checker. Analyze the following text, identify the main factual claims, and evaluate their credibility.

    Provide an overall credibility score from 0-100. For each claim, state it, classify its status ('Verified', 'Uncertain', 'False'), and provide a concise explanation.

    Your response must be a single, valid JSON object with the structure:
    { "overallScore": number, "summary": string, "claims": [{ "claim": string, "status": string, "explanation": string }] }

    Text to analyze:
    ---
    ${text}
    ---`;

    const responseText = await executeGeminiQuery(prompt, { useCache: false }); // Use the core query executor

    try {
        let jsonString = responseText.trim();
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1];
        }
        const parsedResult = JSON.parse(jsonString) as AnalysisResult;

        if (ENABLE_CACHING) {
            const cacheKey = generateCacheKey(`analyze:${text}`);
            analysisCache.set(cacheKey, { result: parsedResult, timestamp: Date.now() });
        }
        return parsedResult;
    } catch (e) {
        console.error("Failed to parse JSON response from analyzeContent:", responseText);
        throw new Error('The AI returned a response in an unexpected format.');
    }
};

export interface EnhancedAnalysisResult extends AnalysisResult {
  verification_results: VerificationResult[] | null;
  enhanced_credibility_score?: number;
}

const calculateEnhancedCredibility = (
  baseScore: number,
  verificationResults: VerificationResult[]
): number => {
  if (!verificationResults || verificationResults.length === 0) {
    return baseScore;
  }
  const averageVerificationScore = verificationResults.reduce((acc, r) => acc + r.confidence_score, 0) / verificationResults.length;
  const enhancedScore = (baseScore + averageVerificationScore) / 2;
  return Math.round(enhancedScore);
};

/**
 * Executes a query against the Gemini API with centralized caching and error handling.
 * @param prompt The prompt to send to the AI.
 * @param options Optional settings for the query.
 * @returns The text response from the AI.
 */
export const executeGeminiQuery = async (
    prompt: string,
    options: { useCache?: boolean; ttl?: number } = {}
): Promise<string> => {
  const { useCache = true, ttl = DEFAULT_CACHE_TTL } = options;

  checkDailyLimit();
  cleanCaches();

  const cacheKey = generateCacheKey(prompt);
  if (ENABLE_CACHING && useCache) {
    const cached = queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < ttl)) {
      return cached.response;
    }
  }

  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    if (isUsingSharedKey()) {
      dailyUsage++;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (ENABLE_CACHING && useCache) {
      queryCache.set(cacheKey, { response: responseText, timestamp: Date.now() });
    }

    return responseText;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            throw new Error('Invalid API key. Please check your API key and try again.');
        }
        if (error.message.includes('SAFETY')) {
            throw new Error('The prompt violates safety guidelines.');
        }
        if (error.message.includes('quota') || error.message.includes('limit')) {
            throw new Error('API quota limit reached. Please check your account or add a new API key.');
        }
    }
    throw error; // Re-throw for the handler to catch
  }
};

const parseQueryArray = (result: string): string[] => {
  try {
    const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(result);
  } catch (error) {
    console.error("Failed to parse query array from AI response:", result);
    return [];
  }
};
