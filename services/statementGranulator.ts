import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GranularityAnalysisResult } from '../types/granularity';

// Simple in-memory cache (consider Redis for production)
const analysisCache = new Map<string, { result: GranularityAnalysisResult; timestamp: number }>();
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '1800000', 10); // 30 minutes
const ENABLE_CACHING = process.env.ENABLE_CACHING === 'true';

// API usage tracking (only for shared API key)
let dailyUsage = 0;
let lastResetDate = new Date().toDateString();

const DAILY_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT || '100', 10);
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

export const granulateStatements = async (text: string): Promise<GranularityAnalysisResult> => {
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

  const prompt = `You are an expert in linguistic analysis and fact-checking. Your task is to take the following factual claim and perform two main tasks:
1.  **Named Entity Recognition (NER):** Identify and categorize named entities within the claim. The entity types to look for are: PERSON, ORGANIZATION, LOCATION, DATE, EVENT.
2.  **Statement Granularity:** Break down the complex sentence into its simplest, most verifiable, atomic statements. A statement is atomic if it contains only one subject-verb-object relationship.

Provide the output as a single, valid JSON object. Do not include any text, markdown formatting like \`\`\`json, or any explanations outside of this JSON object. The JSON object must contain an array named "atomicStatements". Each item in the array should represent an atomic statement and contain the following keys:
-   "statement": a string representing the atomic statement.
-   "entities": an array of objects, where each object represents an identified entity and has "text" and "type" keys.

Example:
Claim: "The CEO of ACME Inc., John Doe, announced on Tuesday that the new factory in Springfield, which was part of the 'Sunrise Project' event, will open next month."

Expected JSON Output:
{
  "atomicStatements": [
    {
      "statement": "John Doe is the CEO of ACME Inc.",
      "entities": [
        { "text": "John Doe", "type": "PERSON" },
        { "text": "ACME Inc.", "type": "ORGANIZATION" }
      ]
    },
    {
      "statement": "John Doe made an announcement on Tuesday.",
      "entities": [
        { "text": "John Doe", "type": "PERSON" },
        { "text": "Tuesday", "type": "DATE" }
      ]
    },
    {
      "statement": "The new factory will open next month.",
      "entities": [
        { "text": "next month", "type": "DATE" }
      ]
    },
    {
      "statement": "The new factory is located in Springfield.",
      "entities": [
        { "text": "Springfield", "type": "LOCATION" }
      ]
    },
    {
        "statement": "The new factory was part of the 'Sunrise Project' event.",
        "entities": [
            { "text": "Sunrise Project", "type": "EVENT" }
        ]
    }
  ]
}

Factual claim to analyze:
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
      !Array.isArray(parsedResult.atomicStatements) ||
      !parsedResult.atomicStatements.every((s: any) =>
        typeof s.statement === 'string' &&
        Array.isArray(s.entities) &&
        s.entities.every((e: any) => typeof e.text === 'string' && typeof e.type === 'string')
      )
    ) {
      throw new Error('The AI returned a response with a missing or invalid structure. Please try again.');
    }

    const finalResult = parsedResult as GranularityAnalysisResult;

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
