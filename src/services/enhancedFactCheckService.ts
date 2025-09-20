// services/enhancedFactCheckService.ts
import { FactCheckReport } from '../types/factCheck';
import { parseAndValidateFactCheckResponse } from '../utils/jsonParser';
import { getGeminiApiKey } from './apiKeyService';
import { GoogleGenAI } from "@google/genai";

export class EnhancedFactCheckService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }

  private async callGeminiAPI(prompt: string): Promise<string> {
    const result = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return result.text;
  }

  private async enhancedFactCheck(text: string, method: string): Promise<FactCheckReport> {
    const startTime = performance.now();
    try {
      // Build your prompt for the AI model
      const prompt = this.buildFactCheckPrompt(text, method);

      // Get raw response from AI model
      const rawResponse = await this.callGeminiAPI(prompt);

      // Parse and validate the response using the robust parser
      const parsedResponse = parseAndValidateFactCheckResponse(rawResponse);

      // Add metadata and processing information
      const enhancedReport: FactCheckReport = {
        ...parsedResponse,
        originalText: text,
        metadata: {
          ...parsedResponse.metadata,
          method_used: method,
          processing_time_ms: performance.now() - startTime,
          apis_used: ['gemini'],
          sources_consulted: parsedResponse.metadata?.sources_consulted || {
            total: 0,
            high_credibility: 0,
            conflicting: 0
          },
          warnings: parsedResponse.metadata?.warnings || []
        }
      };

      return enhancedReport;
    } catch (error) {
      console.error('Error in enhanced fact-check:', error);

      // Re-throw with more context
      if (error instanceof SyntaxError) {
        throw new Error('The AI model returned an invalid JSON structure. This may be a temporary issue.');
      }

      throw error;
    }
  }

  private buildFactCheckPrompt(text: string, method: string): string {
    return `
Please analyze the following text for factual accuracy and return a JSON response with the exact structure specified.

Text to analyze: "${text}"

Method: ${method}

IMPORTANT: Your response must be valid JSON only. Do not wrap it in markdown code blocks or add any explanatory text.

Required JSON structure:
{
  "final_verdict": "string (e.g., 'Mostly True', 'False', 'Mixed', etc.)",
  "final_score": number (0-100),
  "reasoning": "string explaining the analysis",
  "score_breakdown": {
    "final_score_formula": "string describing how the score was calculated",
    "metrics": [
      {
        "name": "string",
        "score": number (0-100),
        "description": "string"
      }
    ],
    "confidence_intervals": {
      "lower_bound": number,
      "upper_bound": number
    }
  },
  "evidence": [
    {
      "id": "string",
      "quote": "string",
      "publisher": "string",
      "score": number (0-100),
      "url": "string or null"
    }
  ],
  "metadata": {
    "method_used": "${method}",
    "processing_time_ms": 0,
    "apis_used": ["gemini"],
    "sources_consulted": {
      "total": number,
      "high_credibility": number,
      "conflicting": number
    },
    "warnings": []
  },
  "searchEvidence": {
    "query": "string",
    "results": []
  },
  "originalTextSegments": [],
  "enhanced_claim_text": ""
}

Return only the JSON object, no additional text or formatting.`;
  }

  // Updated orchestration method with better error handling
  async orchestrateFactCheck(text: string, method: string): Promise<FactCheckReport> {
    try {
      console.log(`Starting fact-check orchestration with method '${method}'`);

      const result = await this.enhancedFactCheck(text, method);

      console.log('Fact-check orchestration completed successfully');
      return result;

    } catch (error) {
      console.error(`Error during fact-check orchestration with method '${method}':`, error);

      // Provide more specific error messages
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        throw new Error('The AI service returned an improperly formatted response. Please try again.');
      }

      if (error.message.includes('invalid JSON structure')) {
        throw new Error('Analysis failed: The AI model returned an invalid response format. This may be a temporary issue.');
      }

      // For network or API errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new Error('Network error: Unable to connect to the fact-checking service. Please check your internet connection and try again.');
      }

      // For API key issues
      if (error.message.includes('API key') || error.message.includes('unauthorized')) {
        throw new Error('Authentication error: Please check your API keys in Settings.');
      }

      // Generic fallback
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  // Helper method to retry failed requests with exponential backoff
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation errors or permanent failures
        if (error.message.includes('API key') ||
            error.message.includes('unauthorized') ||
            error.message.includes('invalid JSON structure')) {
          throw error;
        }

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
