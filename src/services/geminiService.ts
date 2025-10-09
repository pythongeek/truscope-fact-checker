// src/services/geminiService.ts - REFACTORED VERSION

// This service is now environment-agnostic and does not rely on browser-specific APIs for its core function.

// ✅ CORRECT: Google AI Studio API URL
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ✅ FIXED: Updated to use actual existing Gemini models
const GEMINI_MODEL_FALLBACK_ORDER = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

interface GeminiConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Fetches the list of available Gemini models from the API. (Client-side use)
 * This function is safe as it requires the API key to be passed in.
 */
export async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  if (!apiKey || apiKey.trim() === '') {
    console.warn('⚠️ No API key provided for model fetching');
    return GEMINI_MODEL_FALLBACK_ORDER;
  }

  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  try {
    console.log('🔍 Fetching available Gemini models...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`⚠️ Model fetch failed with status ${response.status}`);
      return GEMINI_MODEL_FALLBACK_ORDER;
    }

    const data = await response.json();

    if (!data.models || !Array.isArray(data.models)) {
      console.warn('⚠️ Unexpected API response format');
      return GEMINI_MODEL_FALLBACK_ORDER;
    }

    // Filter for models that support generateContent
    const availableModels = data.models
      .filter((model: any) =>
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => model.name.replace('models/', ''))
      .filter((name: string) => name.startsWith('gemini'));

    console.log(`✅ Found ${availableModels.length} available models`);

    return availableModels.length > 0 ? availableModels : GEMINI_MODEL_FALLBACK_ORDER;

  } catch (error: any) {
    console.error('❌ Error fetching Gemini models:', error.message);
    return GEMINI_MODEL_FALLBACK_ORDER;
  }
}

/**
 * Generates text using the Gemini API with robust fallback mechanism.
 * This function is now ENVIRONMENT-AGNOSTIC and can be used on the server.
 */
export async function generateTextWithFallback(
  prompt: string,
  config: GeminiConfig = {}
): Promise<string> {
  // This function is now environment-agnostic. It relies SOLELY on the passed-in config.
  const apiKey = config.apiKey;

  if (!apiKey || apiKey.trim() === '') {
    // The error is now generic as it can be triggered from the server or client.
    throw new Error('❌ Gemini API key is required.');
  }

  // Validate prompt
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('❌ Prompt cannot be empty');
  }

  // Create unique, ordered list of models to try
  const preferredModel = config.model || 'gemini-2.0-flash-exp';
  const modelsToTry = [
    preferredModel,
    ...GEMINI_MODEL_FALLBACK_ORDER.filter(m => m !== preferredModel)
  ];

  console.log('🔄 Attempting text generation with models:', modelsToTry.slice(0, 3));

  let lastError: Error | null = null;
  let attemptCount = 0;

  for (const model of modelsToTry) {
    attemptCount++;

    try {
      console.log(`🤖 Attempt ${attemptCount}: Trying model "${model}"`);

      const fullApiUrl = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: config.temperature ?? 0.3,
          maxOutputTokens: config.maxOutputTokens ?? 4096,
          topP: 0.95,
          topK: 40
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE'
          }
        ]
      };

      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error(`❌ Non-JSON response from model ${model}:`, textResponse.substring(0, 200));
        lastError = new Error(`Model ${model} returned non-JSON response (likely HTML error page)`);
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error?.message || `HTTP ${response.status}`;
        console.warn(`⚠️ Model ${model} failed: ${errorMessage}`);
        lastError = new Error(`Model ${model} failed: ${errorMessage}`);

        if (response.status === 404) {
          console.log(`ℹ️ Model ${model} not found, trying next...`);
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error(`❌ Authentication failed: ${errorMessage}`);
        }

        continue;
      }

      const candidate = data.candidates?.[0];

      if (!candidate) {
        console.warn(`⚠️ Model ${model} returned no candidates`);
        lastError = new Error(`Model ${model} returned no candidates`);
        continue;
      }

      if (candidate.finishReason === 'SAFETY') {
        console.warn(`⚠️ Model ${model} blocked by safety filters`);
        lastError = new Error(`Model ${model} blocked by safety filters`);
        continue;
      }

      const text = candidate.content?.parts?.[0]?.text;

      if (!text || text.trim().length === 0) {
        console.warn(`⚠️ Model ${model} returned empty text`);
        lastError = new Error(`Model ${model} returned empty response`);
        continue;
      }

      console.log(`✅ Success with model: ${model} (${text.length} chars)`);
      return text;

    } catch (error: any) {
      console.error(`🚨 Unexpected error with model ${model}:`, error.message);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error.message.includes('fetch') || error.message.includes('network')) {
        continue;
      }
    }
  }

  const errorMsg = lastError?.message || 'Unknown error occurred';
  throw new Error(`❌ All Gemini models failed after ${attemptCount} attempts. Last error: ${errorMsg}`);
}

/**
 * Simple wrapper for single model generation (for backward compatibility)
 */
export async function generateText(
  prompt: string,
  apiKey: string,
  model: string = 'gemini-2.0-flash-exp'
): Promise<string> {
  return generateTextWithFallback(prompt, { apiKey, model });
}