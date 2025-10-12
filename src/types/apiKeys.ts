// src/types/apiKeys.ts
// Type definitions for API keys

export interface ApiKeys {
  gemini?: string;
  geminiModel?: string;
  factCheck?: string;
  search?: string;
  searchId?: string;
  serp?: string;
  webz?: string;
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

// Settings configuration
export interface SettingsConfig {
  apiKeys: ApiKeys;
  preferences?: {
    theme?: 'light' | 'dark';
    language?: string;
    autoSave?: boolean;
  };
}

// Analysis configuration
export interface AnalysisConfig {
  depth: 'quick' | 'standard' | 'deep';
  sources: number;
  includeImages?: boolean;
  maxProcessingTime?: number;
  enableAI?: boolean;
}

// API Status for health checks
export interface ApiStatus {
  gemini: boolean;
  serp: boolean;
  webz: boolean;
  googleFactCheck: boolean;
}
