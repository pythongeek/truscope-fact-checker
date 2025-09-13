import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult } from '../types';
import type { VerificationResult } from '../types/verification';

// --- Caching Configuration ---
const DEFAULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const ENABLE_CACHING = process.env.NODE_ENV !== 'development';

// Simple in-memory caches (consider Redis for production)
const queryCache = new Map<string, { response: string; timestamp: number }>();
const analysisCache = new Map<string, { result: AnalysisResult; timestamp: number }>();

// API usage tracking (only for shared API key)
let dailyUsage = 0;
let lastResetDate = new Date().toDateString();

/**
 * The maximum number of daily requests allowed for the shared API key.
 */
export const DAILY_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT || '100', 10);
const SHARED_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Retrieves the user's API key from local storage.
 * @returns {string | null} The user's API key, or null if not found or if local storage is inaccessible.
 */
const getUserApiKey = (): string | null => {
  try {
    return localStorage.getItem('gemini_api_key');
  } catch {
    return null;
  }
};

/**
 * Determines the appropriate API key to use (user's key takes precedence over shared key).
 * @returns {string} The API key to be used for the request.
 * @throws {Error} If no API key (neither user-provided nor shared) is available.
 */
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

/**
 * Checks if the application is currently using the shared API key.
 * @returns {boolean} True if the shared API key is being used, false otherwise.
 */
const isUsingSharedKey = (): boolean => {
  return !getUserApiKey();
};

/**
 * Checks and resets the daily usage limit for the shared API key if a new day has started.
 * @returns {boolean} True if the daily limit has not been reached, false otherwise.
 */
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

/**
 * Generates a consistent cache key from a given string.
 * @param {string} text - The input string to hash.
 * @returns {string} A string representation of the hash.
 */
const generateCacheKey = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

/**
 * Removes expired entries from the in-memory caches.
 */
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

/**
 * Gets the current daily usage count for the shared API key.
 * @returns {number} The number of requests made today with the shared key.
 */
export const getDailyUsage = (): number => {
  if (!isUsingSharedKey()) {
    return 0; // No usage tracking for user's own API key
  }
  checkDailyLimit();
  return dailyUsage;
};

/**
 * Analyzes a piece of content to identify factual claims and assess credibility.
 * This function uses a specific prompt to get a structured JSON response from the AI.
 *
 * @param {string} text - The content to analyze.
 * @returns {Promise<AnalysisResult>} A promise that resolves to the structured analysis result.
 * @throws {Error} If the AI returns a response in an unexpected format.
 */
export const analyzeContent = async (text: string): Promise<AnalysisResult> => {
    cleanCaches();

    const cacheKey = generateCacheKey(`analyze:${text}`);
    if (ENABLE_CACHING) {
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

    const responseText = await executeGeminiQuery(prompt, { useCache: false });

    try {
        let jsonString = responseText.trim();
        const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            jsonString = jsonMatch[1];
        }
        const parsedResult = JSON.parse(jsonString) as AnalysisResult;

        if (ENABLE_CACHING) {
            analysisCache.set(cacheKey, { result: parsedResult, timestamp: Date.now() });
        }
        return parsedResult;
    } catch (e) {
        console.error("Failed to parse JSON response from analyzeContent:", responseText);
        throw new Error('The AI returned a response in an unexpected format.');
    }
};

/**
 * Extends the base AnalysisResult with verification data.
 */
export interface EnhancedAnalysisResult extends AnalysisResult {
  /**
   * An array of verification results for the claims.
   */
  verification_results: VerificationResult[] | null;
  /**
   * An optional enhanced credibility score, recalculated based on verification results.
   */
  enhanced_credibility_score?: number;
}

/**
 * Recalculates the credibility score by averaging the base score with verification confidence scores.
 * @param {number} baseScore - The initial credibility score from the analysis.
 * @param {VerificationResult[]} verificationResults - The results from the verification process.
 * @returns {number} The recalculated, rounded credibility score.
 */
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
 * Executes a query against the Gemini API with centralized caching, rate limiting, and error handling.
 * @param {string} prompt - The prompt to send to the AI.
 * @param {object} [options={}] - Optional settings for the query.
 * @param {boolean} [options.useCache=true] - Whether to use the cache for this query.
 * @param {number} [options.ttl=DEFAULT_CACHE_TTL] - The cache time-to-live in milliseconds.
 * @returns {Promise<string>} A promise that resolves to the text response from the AI.
 * @throws {Error} If the API call fails or returns a specific, handled error (e.g., invalid key, safety violation).
 */
export const executeGeminiQuery = async (
    prompt: string,
    options: { useCache?: boolean; ttl?: number } = {}
): Promise<string> => {
  const { useCache = true, ttl = DEFAULT_CACHE_TTL } = options;

  if (!checkDailyLimit()) {
    throw new Error('The daily API request limit for the shared key has been reached.');
  }
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

/**
 * Parses a string that is expected to be a JSON array, potentially wrapped in markdown code blocks.
 * @param {string} result - The input string from the AI response.
 * @returns {string[]} An array of strings, or an empty array if parsing fails.
 */
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
