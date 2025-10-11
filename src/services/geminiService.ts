// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from '../utils/logger';

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

const generateTextWithFallback = async (prompt: string, options: GeminiOptions): Promise<string | null> => {
  const models = [options.model || 'gemini-1.5-flash', 'gemini-pro'];
  for (const model of models) {
    try {
      const result = await geminiService.generateText(prompt, options.apiKey, model);
      if (result) {
        logger.info(`Successfully generated text with model: ${model}`);
        return result;
      }
    } catch (error) {
      logger.warn(`Model ${model} failed, trying next model.`, { error });
    }
  }
  logger.error('All Gemini models failed to generate text.', new Error('All models failed'));
  return null;
};

export const geminiService = {
  async generateText(prompt: string, apiKey?: string, modelName: string = 'gemini-1.5-flash'): Promise<string> {
    if (!apiKey) {
        logger.error('Gemini API key is missing', new Error('API key not provided'));
        throw new Error("Gemini API key is not set.");
    }
    try {
      logger.info('Generating text with Gemini', { model: modelName });
      const generativeModel = getGenAI(apiKey).getGenerativeModel({ model: modelName });
      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
      logger.info('Successfully received response from Gemini');
      return response.text();
    } catch (error) {
      logger.error('Error in Gemini text generation', error);
      throw error;
    }
  },
};

export { generateTextWithFallback };

export const fetchAvailableModels = async (apiKey: string): Promise<string[]> => {
  // This is a mock implementation. In a real scenario, you would query the Gemini API.
  return ['gemini-1.5-flash', 'gemini-pro'];
};
