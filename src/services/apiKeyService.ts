// src/services/apiKeyService.ts - Manages user API keys in browser storage
export interface ApiKeyConfig {
  gemini: string;              // Gemini AI Studio API key
  geminiModel: string;         // Selected Gemini model
  factCheck: string;           // Google Fact Check Tools API key
  search: string;              // Google Search API key
  searchId: string;            // Google Search Engine ID
}

const STORAGE_key = 'truscope_api_keys';

/**
 * Get stored API keys from localStorage
 */
export function getApiKeys(): Partial<ApiKeyConfig> {
  try {
    const stored = localStorage.getItem(STORAGE_key);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    console.log('📥 API keys loaded from storage');
    return parsed;
  } catch (error) {
    console.error('Failed to load API keys:', error);
    return {};
  }
}

/**
 * Save API keys to localStorage
 */
export function saveApiKeys(keys: Partial<ApiKeyConfig>): void {
  try {
    const existing = getApiKeys();
    const updated = { ...existing, ...keys };
    localStorage.setItem(STORAGE_key, JSON.stringify(updated));
    console.log('💾 API keys saved to storage');
  } catch (error) {
    console.error('Failed to save API keys:', error);
    throw new Error('Failed to save API keys. Please try again.');
  }
}

/**
 * Get Gemini API key (backward compatible)
 */
export function getGeminiApiKey(): string {
  const keys = getApiKeys();
  return keys.gemini || '';
}

/**
 * Get Gemini model (backward compatible)
 */
export function getGeminiModel(): string {
  const keys = getApiKeys();
  return keys.geminiModel || 'gemini-1.5-flash-latest';
}

/**
 * Get Search API key (backward compatible)
 */
export function getSearchApiKey(): string {
  const keys = getApiKeys();
  return keys.search || '';
}

/**
 * Get Search Engine ID (backward compatible)
 */
export function getSearchId(): string {
  const keys = getApiKeys();
  return keys.searchId || '';
}

/**
 * Test if a Gemini API key is valid
 */
export const testGeminiKey = async (apiKey: string): Promise<boolean> => {
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
};
