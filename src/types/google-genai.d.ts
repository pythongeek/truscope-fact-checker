// src/types/google-genai.d.ts
// Type declarations for @google/genai and @google/generative-ai modules

declare module '@google/genai' {
  export interface GenerativeModelConfig {
    model?: string;
    apiKey?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }

  export interface GenerationConfig {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    responseMimeType?: string; // Added for JSON mode support
    responseSchema?: Schema; // Added for structured output
  }

  export interface GenerateContentRequest {
    contents: Array<{
      role?: string;
      parts: Array<{
        text: string;
      }>;
    }>;
    generationConfig?: GenerationConfig;
  }

  export interface GenerateContentResponse {
    response: {
      text(): string;
      candidates?: any[];
    };
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: { model: string; generationConfig?: GenerationConfig }): GenerativeModel;
  }

  // Alias for GoogleGenerativeAI (used in some files)
  export class GoogleGenAI {
    constructor(apiKey: string);
    getGenerativeModel(config: { model: string; generationConfig?: GenerationConfig }): GenerativeModel;
  }

  export class GenerativeModel {
    generateContent(request: GenerateContentRequest | string): Promise<GenerateContentResponse>;
  }

  export interface Schema {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    items?: Schema;
    description?: string;
  }

  export const SchemaType: {
    STRING: string;
    NUMBER: string;
    INTEGER: string;
    BOOLEAN: string;
    ARRAY: string;
    OBJECT: string;
  };

  // Type export for use in type annotations
  export type Type = Schema;
}

// Type declarations for @google/generative-ai module (official package)
declare module '@google/generative-ai' {
  export interface GenerativeModelConfig {
    model?: string;
    apiKey?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }

  export interface GenerationConfig {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    responseMimeType?: string; // Added for JSON mode support
    responseSchema?: Schema; // Added for structured output
  }

  export interface GenerateContentRequest {
    contents: Array<{
      role?: string;
      parts: Array<{
        text: string;
      }>;
    }>;
    generationConfig?: GenerationConfig;
  }

  export interface GenerateContentResponse {
    response: {
      text(): string;
      candidates?: any[];
    };
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: { model: string; generationConfig?: GenerationConfig }): GenerativeModel;
  }

  export class GenerativeModel {
    generateContent(request: GenerateContentRequest | string): Promise<GenerateContentResponse>;
  }

  export interface Schema {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    items?: Schema;
    description?: string;
  }

  // Export SchemaType for the official package
  export enum SchemaType {
    STRING = "string",
    NUMBER = "number",
    INTEGER = "integer",
    BOOLEAN = "boolean",
    ARRAY = "array",
    OBJECT = "object"
  }

  // Type export for use in type annotations
  export type Type = Schema;
}
