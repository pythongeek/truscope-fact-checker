// Client-side AI editor service for Vite React project
import { GoogleGenerativeAI } from '@google/generative-ai';

export class ClientAIEditorService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  setApiKey(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async processContent(
    prompt: string,
    config: string,
    maxTokens: number = 2000
  ): Promise<{ content: string; confidence: number; config: string; tokensUsed: number }> {
    if (!this.genAI) {
      throw new Error('API key not configured. Please set your Gemini API key.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: maxTokens,
        }
      });

      const response = result.response;
      const content = response.text();

      // Calculate confidence based on response quality (simplified)
      const confidence = Math.min(0.95, Math.max(0.6, content.length / 1000));

      return {
        content,
        confidence,
        config,
        tokensUsed: content.split(' ').length
      };

    } catch (error) {
      console.error('AI Editor error:', error);
      throw new Error(`Failed to process content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
