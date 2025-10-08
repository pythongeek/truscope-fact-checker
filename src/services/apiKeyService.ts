// src/services/apiKeyService.ts
// Service for managing API keys in local storage
import { ApiKeys } from '@/types/apiKeys';

const STORAGE_KEY = 'truescope-api-keys';

/**
 * Get API keys from local storage
 */
export function getApiKeys(): ApiKeys {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to retrieve API keys:', error);
  }
  return {};
}

/**
 * Set API keys in local storage
 */
export function setApiKeys(keys: ApiKeys): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (error) {
    console.error('Failed to save API keys:', error);
    throw new Error('Failed to save API keys to storage');
  }
}

/**
 * Clear all API keys from local storage
 */
export function clearApiKeys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear API keys:', error);
  }
}

/**
 * Check if a specific API key is configured
 */
export function hasApiKey(key: keyof ApiKeys): boolean {
  const keys = getApiKeys();
  return !!(keys[key] && keys[key]?.trim());
}

/**
 * Get a specific API key
 */
export function getApiKey(key: keyof ApiKeys): string | undefined {
  const keys = getApiKeys();
  return keys[key];
}

/**
 * Set a specific API key
 */
export function setApiKey(key: keyof ApiKeys, value: string): void {
  const keys = getApiKeys();
  keys[key] = value;
  setApiKeys(keys);
}

/**
 * Validate that required API keys are present
 */
export function validateApiKeys(required: Array<keyof ApiKeys> = ['gemini']): {
  valid: boolean;
  missing: Array<keyof ApiKeys>;
} {
  const keys = getApiKeys();
  const missing: Array<keyof ApiKeys> = [];

  for (const key of required) {
    if (!keys[key] || !keys[key]?.trim()) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Checks if all required API keys are configured.
 * @returns {boolean} True if all required keys are configured, false otherwise.
 */
export function areRequiredKeysConfigured(): boolean {
  const { valid } = validateApiKeys(['gemini']);
  return valid;
}

/**
 * Retrieves the configuration status of all API keys.
 * @returns An object detailing which keys are configured.
 */
export function getConfigurationStatus() {
  const keys = getApiKeys();
  const allKeys: Array<keyof ApiKeys> = ['gemini', 'factCheck', 'search', 'searchId'];
  const status = {
    hasGemini: hasApiKey('gemini'),
    hasFactCheck: hasApiKey('factCheck'),
    hasSearch: hasApiKey('search'),
    hasSearchId: hasApiKey('searchId'),
    configuredCount: 0,
    totalKeys: allKeys.length
  };
  status.configuredCount = allKeys.filter(key => !!keys[key]).length;
  return status;
}

/**
 * Specific getter for the Gemini API key.
 * @returns The Gemini API key or undefined if not set.
 */
export function getGeminiApiKey(): string | undefined {
  return getApiKey('gemini');
}

/**
 * Gets the configured Gemini model or a default.
 * @returns The configured Gemini model name.
 */
export function getGeminiModel(): string {
  return getApiKey('geminiModel') || 'gemini-1.5-flash-latest';
}

/**
 * Specific getter for the Search API key.
 * @returns The Search API key or undefined if not set.
 */
export function getSearchApiKey(): string | undefined {
  return getApiKey('search');
}

/**
 * Specific getter for the Search ID.
 * @returns The Search ID or undefined if not set.
 */
export function getSearchId(): string | undefined {
  return getApiKey('searchId');
}
