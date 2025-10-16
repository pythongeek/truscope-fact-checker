// src/services/vertexAiService.ts
import { logger } from '../utils/logger';

/**
 * Interface for Vertex AI generation options.
 * This will be passed to our backend API route.
 */
interface VertexAIOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * A new service for interacting with Vertex AI via a secure, server-side API route.
 * This service does NOT handle API keys directly. It calls our own backend,
 * which then securely authenticates and calls the Vertex AI API.
 */
export const vertexAiService = {
  /**
   * Generates text by sending a prompt to our secure backend API route.
   *
   * @param prompt - The text prompt to send to the model.
   * @param options - Optional configuration for the generation request.
   * @returns A promise that resolves to the generated text as a string.
   */
  async generateText(
    prompt: string,
    options?: VertexAIOptions
  ): Promise<string> {
    try {
      logger.info('Sending prompt to secure Vertex AI backend', {
        promptLength: prompt.length,
        options,
      });

      // We POST to our own API endpoint. The body will contain the prompt
      // and any other options we want to pass to the model.
      const response = await fetch('/api/vertex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          options: {
            // Provide default values if none are passed
            model: options?.model || 'gemini-1.5-flash-001',
            temperature: options?.temperature ?? 0.3,
            maxOutputTokens: options?.maxOutputTokens ?? 2048,
          },
        }),
      });

      // Check if the request was successful
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const text = data.text;

      if (!text || text.trim().length === 0) {
        throw new Error('Generated text is empty or invalid.');
      }

      logger.info('Successfully received response from Vertex AI backend', {
        responseLength: text.length,
      });

      return text;

    } catch (error: any) {
      logger.error('Error in vertexAiService.generateText', {
        errorMessage: error.message,
      });
      // Re-throw the error so the calling component can handle it (e.g., show a toast notification)
      throw new Error(`Failed to generate text with Vertex AI: ${error.message}`);
    }
  },
};
