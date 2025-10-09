// src/services/geminiService.ts

import { getApiKeys } from './apiKeyService';

// The correct base URL for the Google AI Studio (Generative Language) API
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// A prioritized list of models to try. This adds stability.
// If the user's selected model fails, the system will try these in order.
const GEMINI_MODEL_FALLBACK_ORDER = [
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-pro',
];

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Fetches the list of available Gemini models from the API.
 * This will be used to populate the settings dropdown.
 * @param apiKey The user's Gemini API key.
 * @returns A promise that resolves to an array of model names.
 */
export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('A valid Gemini API key is required to fetch models.');
  }

  const url = `${GEMINI_API_URL}?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch models: ${errorData.error?.message || response.statusText}`);
    }
    const data = await response.json();
    // Filter for models that can actually generate content and return their names
    return data.models
      .filter((model: any) => model.supportedGenerationMethods.includes('generateContent'))
      .map((model: any) => model.name.replace('models/', ''));
  } catch (error) {
    console.error("Error fetching Gemini models:", error);
    // Return the fallback list if the API call fails for any reason
    return GEMINI_MODEL_FALLBACK_ORDER;
  }
}


/**
 * Generates text using the Gemini API with a robust fallback mechanism.
 * If the primary model fails, it iterates through the fallback list.
 * @param prompt The prompt to send to Gemini.
 * @param config Configuration including optional user API key and preferred model.
 * @returns A promise that resolves to the generated text as a string.
 */
export async function generateTextWithFallback(
  prompt: string,
  config: GeminiConfig = {}
): Promise<string> {
  const apiKeys = getApiKeys();
  const apiKey = config.apiKey || apiKeys.gemini;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API key is required. Please configure it in Settings.');
  }

  // Create a unique, ordered list of models to try, starting with the user's preference.
  const preferredModel = config.model || apiKeys.geminiModel || 'gemini-1.5-flash-latest';
  const modelsToTry = [
    preferredModel,
    ...GEMINI_MODEL_FALLBACK_ORDER.filter(m => m !== preferredModel)
  ];

  let lastError: Error | null = null;

  console.log('🔄 Attempting to generate text with models in order:', modelsToTry);

  for (const model of modelsToTry) {
    try {
      console.log(`🤖 Trying model: ${model}`);
      const fullApiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: config.temperature ?? 0.7,
            maxOutputTokens: config.maxOutputTokens ?? 4096,
            // Add safety settings if needed
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error('Received an empty response from the API.');
        }
        console.log(`✅ Success with model: ${model}`);
        // Return the first successful response
        return text;
      } else {
        const errorData = await response.json();
        const errorMessage = `Model ${model} failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'}`;
        console.warn(`⚠️ ${errorMessage}`);
        lastError = new Error(errorMessage);
        // If it's a 404, the model likely doesn't exist, so we continue to the next
        if (response.status === 404) continue;
        // For other errors (like auth or billing), we can optionally break early
        // but for now we will continue to try other models.
      }
    } catch (error) {
      console.error(`🚨 An unexpected error occurred with model ${model}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // If the loop completes without a successful response, throw the last known error.
  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || 'An unknown error occurred'}`);
}
