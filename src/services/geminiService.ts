// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from '../utils/logger.js';
// FIX: The import now correctly matches the export from apiKeyService.ts
import { apiKeyService } from './apiKeyService';

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

const generateTextWithFallback = async (
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

export const geminiService = {
  async generateText(
    prompt: string, 
    apiKey?: string, 
    modelName: string = 'gemini-2.0-flash-exp',
    options?: Partial<GeminiOptions>
  ): Promise<string> {
    // FIX: This now uses the correct function from the apiKeyService to get the Gemini key.
    const effectiveApiKey = apiKey || apiKeyService.getGeminiApiKey();

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
        responseLength
