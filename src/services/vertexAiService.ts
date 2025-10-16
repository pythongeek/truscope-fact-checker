// src/services/vertexAiService.ts

import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger'; // Assuming you have a logger utility

/**
 * Configuration options for the generative model.
 */
export interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

/**
 * Safety settings to filter out harmful content.
 */
export interface SafetySetting {
  category: string; // e.g., 'HARM_CATEGORY_HARASSMENT'
  threshold: string; // e.g., 'BLOCK_MEDIUM_AND_ABOVE'
}

/**
 * Options required to initialize the VertexAIService.
 * These will be passed from your Vercel API endpoint for each request.
 */
export interface VertexAIServiceOptions {
  apiKey: string;
  projectId: string;
  location: string;
  model?: string; // e.g., 'gemini-1.5-pro-001'
}

/**
 * A service class for interacting with the Google Vertex AI REST API.
 * This class is designed to be instantiated per-request with a user-provided API key.
 */
export class VertexAIService {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly modelId: string;
  private readonly apiUrl: string;

  constructor(options: VertexAIServiceOptions) {
    if (!options.apiKey || !options.projectId || !options.location) {
      throw new Error('API Key, Project ID, and Location are required for Vertex AI Service.');
    }
    this.apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.modelId = options.model || 'gemini-1.5-flash-001';

    // Construct the REST API endpoint URL
    this.apiUrl = `https://${options.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${options.location}/publishers/google/models/${this.modelId}`;
  }

  /**
   * Generates a text response from a single prompt string.
   * @param prompt - The text prompt to send to the model.
   * @param systemInstruction - An optional instruction to guide the model's behavior.
   * @param config - Optional configuration for the generation process.
   * @param safetySettings - Optional safety settings to override defaults.
   * @returns The generated text content as a string.
   */
  public async generateText(
    prompt: string,
    systemInstruction?: string,
    config: GenerationConfig = { temperature: 0.5, maxOutputTokens: 2048 },
    safetySettings?: SafetySetting[]
  ): Promise<string> {
    const endpoint = `${this.apiUrl}:generateContent`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
      ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
      ...(safetySettings && { safetySettings }),
    };

    try {
      logger.info(`Sending request to Vertex AI endpoint: ${endpoint}`);
      const response = await axios.post(endpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Extract text from a potentially complex response structure
      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        logger.warn('Vertex AI response was successful but contained no text.', response.data);
        return '';
      }
      return text;
    } catch (error) {
      this.handleApiError(error, 'generateText');
      throw error; // Re-throw the original error after logging
    }
  }

  /**
   * Generates text as a stream for real-time UI updates.
   * This is an advanced feature that returns an async generator.
   * @param prompt - The text prompt to send to the model.
   * @returns An async iterable that yields chunks of text as they are generated.
   */
  public async *generateTextStream(
    prompt: string,
    systemInstruction?: string,
    config: GenerationConfig = { temperature: 0.5, maxOutputTokens: 4096 }
  ): AsyncGenerator<string> {
    const endpoint = `${this.apiUrl}:streamGenerateContent`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
      ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
    };

    try {
      const response = await axios.post(endpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
      });

      for await (const chunk of response.data) {
        // The raw chunk is a buffer, convert it to a string
        const textChunk = chunk.toString('utf-8');
        try {
          // The stream often sends multiple JSON objects or partials. We need to parse them carefully.
          const jsonStrings = textChunk.replace(/^\[|\]$/g, '').split('},{').map((s: string, i: number, a: string[]) => {
              if (i > 0) s = '{' + s;
              if (i < a.length - 1) s = s + '}';
              return s;
          });

          for (const jsonStr of jsonStrings) {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse stream chunk from Vertex AI.', { chunk: textChunk, error: parseError });
        }
      }
    } catch (error) {
      this.handleApiError(error, 'generateTextStream');
      throw error;
    }
  }

  /**
   * A private helper to log detailed API errors.
   */
  private handleApiError(error: unknown, functionName: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.error(`Vertex AI API error in ${functionName}:`, {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
    } else {
      logger.error(`An unexpected error occurred in ${functionName}:`, error);
    }
  }
}
