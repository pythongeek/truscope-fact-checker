// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from '../utils/logger.js';
import { apiKeyService } from './apiKeyService'; // Added import for the API key service

let genAI: GoogleGenerativeAI | null = null;

const getGenAI = (apiKey: string) => {
  if (!genAI) {
    logger.info('Initializing GoogleGenerativeAI');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

interface GeminiOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Generate text with automatic fallback to alternative models
 * Uses the latest Gemini 2.0 Flash model by default with fallbacks
 */
const generateTextWithFallback = async (
  prompt: string, 
  options: GeminiOptions
): Promise<string | null> => {
  // Updated model list with Gemini 2.0 Flash as primary
  const models = [
    options.model || 'gemini-2.0-flash-exp',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro'
  ];
  
  for (const model of models) {
    try {
      logger.info(`Attempting text generation with model: ${model}`);
      // FIX: This now correctly calls the service's generateText method
      const result = await geminiService.generateText(prompt, options.apiKey, model, options);
      
      if (result && result.trim().length > 0) {
        logger.info(`Successfully generated text with model: ${model}`);
        return result;
      }
    } catch (error: any) {
      logger.warn(`Model ${model} failed: ${error.message}. Trying next model...`);
    }
  }
  
  logger.error('All Gemini models failed to generate text.', new Error('All models exhausted'));
  return null;
};

export const geminiService = {
  /**
   * Generate text using Google Gemini API
   * @param prompt - The text prompt to send to Gemini
   * @param apiKey - (Optional) Google API key. If not provided, it will be retrieved from storage.
   * @param modelName - Model name (default: gemini-2.0-flash-exp)
   * @param options - Additional generation options
   */
  async generateText(
    prompt: string, 
    apiKey?: string, 
    modelName: string = 'gemini-2.0-flash-exp',
    options?: Partial<GeminiOptions>
  ): Promise<string> {
    // FIX: Automatically get the API key from storage if it's not passed in.
    const effectiveApiKey = apiKey || apiKeyService.getApiKey('google');

    if (!effectiveApiKey || effectiveApiKey.trim() === '') {
      logger.error('Gemini API key is missing', new Error('API key not provided'));
      // FIX: Improved error message for the user.
      throw new Error("Gemini API key is not set. Please add it in the settings.");
    }

    try {
      logger.info('Generating text with Gemini', { 
        model: modelName,
        promptLength: prompt.length 
      });

      const generativeModel = getGenAI(effectiveApiKey).getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: options?.temperature ?? 0.3,
          maxOutputTokens: options?.maxOutputTokens ?? 2000,
          topP: 0.95,
          topK: 40,
        },
      });

      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
      
      if (!response) {
        throw new Error('Empty response from Gemini API');
      }

      const text = response.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('Generated text is empty');
      }

      logger.info('Successfully received response from Gemini', { 
        responseLength: text.length 
      });
      
      return text;
    } catch (error: any) {
      logger.error('Error in Gemini text generation', { 
        error: error.message,
        model: modelName 
      });
      throw error;
    }
  },
};

export { generateTextWithFallback };

/**
 * Fetch available Gemini models
 * Returns a list of recommended models in order of preference
 */
export const fetchAvailableModels = async (apiKey: string): Promise<string[]> => {
  // Return latest Gemini 2.0 models as primary options
  // In production, you could query the actual API for available models
  return [
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-pro'
  ];
};
