// src/types/google-genai.d.ts
// Type declarations for @google/genai module

declare module '@google/genai' {
  export interface GenerativeModelConfig {
    model?: string;
    apiKey?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }

  export interface GenerateContentRequest {
    contents: Array<{
      role?: string;
      parts: Array<{
        text: string;
      }>;
    }>;
  }

  export interface GenerateContentResponse {
    response: {
      text(): string;
      candidates?: any[];
    };
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: { model: string }): GenerativeModel;
  }

  export class GenerativeModel {
    generateContent(request: GenerateContentRequest | string): Promise<GenerateContentResponse>;
  }

  export interface Schema {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  }

  export const SchemaType: {
    STRING: string;
    NUMBER: string;
    INTEGER: string;
    BOOLEAN: string;
    ARRAY: string;
    OBJECT: string;
  };
}
