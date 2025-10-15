// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from '../utils/logger.js';
// FIX: Changed the import to correctly bring in the getGeminiApiKey function individually.
import { getGeminiApiKey } from './apiKeyService';

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

export const geminiService = {
  async generateText(
    prompt: string,
    apiKey?: string,
    modelName: string = 'gemini-2.0-flash-exp',
    options?: Partial<Omit<GeminiOptions, 'apiKey'>>
  ): Promise<string> {
    // FIX: No change needed here, it now correctly calls the imported function.
    const effectiveApiKey = apiKey || getGeminiApiKey();

    if (!effectiveApiKey || effectiveApiKey.trim() === '') {
      logger.error('Gemini API key is missing', new Error('API key not provided'));
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
        },
      });

      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
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

/**
 * Generate text with automatic fallback to alternative models
 */
export const generateTextWithFallback = async (
  prompt: string,
  options: GeminiOptions
): Promise<string | null> => {
  const models = [
    options.model || 'gemini-2.0-flash-exp',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro'
  ];

  for (const model of models) {
    try {
      logger.info(`Attempting text generation with model: ${model}`);
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

/**
 * Fetch available Gemini models
 */
export const fetchAvailableModels = async (apiKey: string): Promise<string[]> => {
  if (!apiKey) return [];
  // In a real app, you might fetch this from an API endpoint
  return [
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro'
  ];
};
