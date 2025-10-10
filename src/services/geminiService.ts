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
