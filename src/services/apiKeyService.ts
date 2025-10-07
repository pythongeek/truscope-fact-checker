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
