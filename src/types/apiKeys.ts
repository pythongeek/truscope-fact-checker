// src/types/apiKeys.ts
// Type definitions for API keys

export interface ApiKeys {
  gemini?: string;
  geminiModel?: string;
  factCheck?: string;
  search?: string;
  searchId?: string;
}

export type ApiKeyField = keyof ApiKeys;

export interface ApiKeyConfig {
  id: ApiKeyField;
  label: string;
  group: string;
  url?: string;
  type: 'password' | 'select' | 'text';
  options?: string[];
  description?: string;
  required?: boolean;
}
