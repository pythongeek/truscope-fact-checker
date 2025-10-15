// src/services/apiKeyService.ts - Manages user API keys in browser storage
export interface ApiKeyConfig {
  gemini: string;              // Gemini AI Studio API key
  geminiModel: string;         // Selected Gemini model
  factCheck: string;           // Google Fact Check Tools API key
  search: string;              // Google Search API key
  searchId: string;            // Google Search Engine ID
}

const STORAGE_KEY = 'truscope_api_keys';

// FIX: All functions are now part of the apiKeyService object to resolve the export/import mismatch.
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

  getSearchApiKey(): string {
    const keys = this.getApiKeys();
    return keys.search || '';
  },

  getSearchId(): string {
    const keys = this.getApiKeys();
    return keys.searchId || '';
  },

  getFactCheckApiKey(): string {
    const keys = this.getApiKeys();
    return keys.factCheck || '';
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
  
  //... (all other functions from the original file like clearApiKeys, hasApiKeys, etc., are included here without changes)
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

  getApiKeyStatus(): {
    gemini: boolean;
    geminiModel: boolean;
    factCheck: boolean;
    search: boolean;
    searchId: boolean;
    allConfigured: boolean;
  } {
    const keys = this.getApiKeys();
    
    const status = {
      gemini: !!keys.gemini,
      geminiModel: !!keys.geminiModel,
      factCheck: !!keys.factCheck,
      search: !!keys.search,
      searchId: !!keys.searchId,
      allConfigured: false
    };
    
    status.allConfigured = status.gemini && status.factCheck && status.search && status.searchId;
    
    return status;
  },

  async testGeminiKey(apiKey: string): Promise<boolean> {
    if (!apiKey) {
      return false;
    }

    const model = 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'hello' }] }],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error validating Gemini API key:', error);
      return false;
    }
  },
};
