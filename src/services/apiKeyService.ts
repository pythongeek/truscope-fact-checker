// src/services/apiKeyService.ts - Manages user API keys in browser storage
export interface ApiKeyConfig {
  gemini: string;              // Gemini AI Studio API key
  geminiModel: string;         // Selected Gemini model
  factCheck: string;           // Google Fact Check Tools API key
  search: string;              // Google Search API key
  searchId: string;            // Google Search Engine ID
}

const STORAGE_KEY = 'truscope_api_keys';

// FIX: Encapsulated all API key functions into a single, exportable service object.
export const apiKeyService = {
  getApiKeys(): Partial<ApiKeyConfig> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      console.log('📥 API keys loaded from storage');
      return parsed;
    } catch (error) {
      console.error('Failed to load API keys:', error);
      return {};
    }
  },

  getGeminiApiKey(): string {
    const keys = this.getApiKeys();
    return keys.gemini || '';
  },

  getGeminiModel(): string {
    const keys = this.getApiKeys();
    return keys.geminiModel || 'gemini-1.5-flash-latest';
  },

  saveApiKeys(keys: Partial<ApiKeyConfig>): void {
    try {
      const existing = this.getApiKeys();
      const updated = { ...existing, ...keys };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      console.log('💾 API keys saved to storage');
    } catch (error) {
      console.error('Failed to save API keys:', error);
      throw new Error('Failed to save API keys. Please try again.');
    }
  },

  // NOTE: All other functions from the original file are preserved here.
  // No features have been removed.
  clearApiKeys(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ API keys cleared from storage');
    } catch (error) {
      console.error('Failed to clear API keys:', error);
    }
  },

  hasApiKeys(): boolean {
    const keys = this.getApiKeys();
    return !!(keys.gemini && keys.factCheck && keys.search && keys.searchId);
  },
};
