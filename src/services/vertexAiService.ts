// src/services/vertexAiService.ts

import axios, { AxiosError } from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { logger } from '../utils/logger';

// --- Interfaces remain the same ---
export interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

/**
 * A service class for interacting with the Google Vertex AI REST API.
 * This class is now a singleton, authenticating on the server-side
 * using environment variables instead of per-request API keys.
 */
class VertexAiService {
  private readonly projectId: string;
  private readonly location: string;
  private readonly modelId: string;
  private readonly apiUrl: string;
  private auth: GoogleAuth;

  constructor() {
    // --- Read configuration directly from environment variables ---
    this.projectId = process.env.GCLOUD_PROJECT_ID || '';
    this.location = process.env.GCLOUD_LOCATION || 'us-central1'; // Default location
    this.modelId = 'gemini-1.5-flash-001';

    if (!this.projectId) {
      const configError = new Error('Server configuration error: Missing GCLOUD_PROJECT_ID.');
      logger.error('GCLOUD_PROJECT_ID environment variable is not set. Vertex AI service will fail.', configError);
      throw configError;
    }

    // --- Initialize Google Auth ---
    // This will automatically find and use your GCLOUD_SERVICE_ACCOUNT_KEY_JSON
    this.auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });

    // Construct the REST API endpoint URL
    this.apiUrl = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.modelId}`;
  }

  /**
   * Private helper to get a fresh auth token.
   */
  private async getAuthToken(): Promise<string> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) {
        throw new Error("Failed to retrieve auth token.");
    }
    return accessToken.token;
  }

  /**
   * Generates a text response from a single prompt string.
   */
  public async generateText(
    prompt: string,
    systemInstruction?: string,
    config: GenerationConfig = { temperature: 0.5, maxOutputTokens: 2048 },
    safetySettings?: SafetySetting[]
  ): Promise<string> {
    const endpoint = `${this.apiUrl}:generateContent`;
    const token = await this.getAuthToken();

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
          'Authorization': `Bearer ${token}`, // Use the server-generated token
          'Content-Type': 'application/json',
        },
      });

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        logger.warn('Vertex AI response was successful but contained no text.', response.data);
        return '';
      }
      return text;
    } catch (error) {
      this.handleApiError(error, 'generateText');
      throw error;
    }
  }

  // Note: The stream generation logic remains largely the same, but also needs to fetch the token.
  public async *generateTextStream(
    prompt: string,
    systemInstruction?: string,
    config: GenerationConfig = { temperature: 0.5, maxOutputTokens: 4096 }
  ): AsyncGenerator<string> {
    const endpoint = `${this.apiUrl}:streamGenerateContent`;
    const token = await this.getAuthToken();

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: config,
      ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
    };

    try {
        const response = await axios.post(endpoint, requestBody, {
            headers: {
                'Authorization': `Bearer ${token}`,
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

// --- Export a single instance of the service ---
export const vertexAiService = new VertexAiService();
