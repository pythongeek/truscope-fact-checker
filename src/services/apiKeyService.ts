// src/services/apiKeyService.ts - Complete implementation
const STORAGE_KEY = 'truscope_api_keys';
const STORAGE_VERSION = '1.0';

export interface ApiKeys {
  gemini: string;
  geminiModel: string;
  factCheck: string;
  search: string;
  searchId: string;
  version?: string;
}

const DEFAULT_KEYS: ApiKeys = {
  gemini: '',
  geminiModel: 'gemini-1.5-flash-latest',
  factCheck: '',
  search: '',
  searchId: '',
  version: STORAGE_VERSION
};

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get all API keys from localStorage
 */
export function getApiKeys(): ApiKeys {
  if (!isLocalStorageAvailable()) {
    console.warn('⚠️ localStorage not available, using default keys');
    return { ...DEFAULT_KEYS };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_KEYS };
    }

    const parsed = JSON.parse(stored);

    // Validate and migrate if needed
    if (!parsed.version || parsed.version !== STORAGE_VERSION) {
      console.log('🔄 Migrating API keys to new version');
      const migrated = { ...DEFAULT_KEYS, ...parsed, version: STORAGE_VERSION };
      setApiKeys(migrated);
      return migrated;
    }

    return { ...DEFAULT_KEYS, ...parsed };
  } catch (error) {
    console.error('Failed to retrieve API keys:', error);
    return { ...DEFAULT_KEYS };
  }
}

/**
 * Get a specific API key
 */
export function getApiKey(keyName: keyof ApiKeys): string {
  const keys = getApiKeys();
  return keys[keyName] || '';
}

/**
 * Set all API keys
 */
export function setApiKeys(keys: Partial<ApiKeys>): void {
  if (!isLocalStorageAvailable()) {
    console.error('❌ Cannot save API keys: localStorage not available');
    return;
  }

  try {
    const current = getApiKeys();
    const updated = {
      ...current,
      ...keys,
      version: STORAGE_VERSION
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log('✅ API keys saved successfully');

    // Log which keys are configured (without showing the actual keys)
    const configuredKeys = Object.entries(updated)
      .filter(([key, value]) => key !== 'version' && value && value.trim() !== '')
      .map(([key]) => key);
    
    console.log('📋 Configured API keys:', configuredKeys);
  } catch (error) {
    console.error('Failed to save API keys:', error);
    throw new Error('Failed to save API keys. Please check browser settings.');
  }
}

/**
 * Set a specific API key
 */
export function setApiKey(keyName: keyof ApiKeys, value: string): void {
  const keys = getApiKeys();
  keys[keyName] = value;
  setApiKeys(keys);
}

/**
 * Clear all API keys
 */
export function clearApiKeys(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ API keys cleared');
  } catch (error) {
    console.error('Failed to clear API keys:', error);
  }
}

/**
 * Check if required API keys are configured
 */
export function areRequiredKeysConfigured(): boolean {
  const keys = getApiKeys();

  // Gemini is the only required key for basic functionality
  return !!(keys.gemini && keys.gemini.trim() !== '');
}

/**
 * Get configuration status
 */
export function getConfigurationStatus(): {
  hasGemini: boolean;
  hasFactCheck: boolean;
  hasSearch: boolean;
  isFullyConfigured: boolean;
  configuredCount: number;
  totalKeys: number;
} {
  const keys = getApiKeys();

  const hasGemini = !!(keys.gemini && keys.gemini.trim());
  const hasFactCheck = !!(keys.factCheck && keys.factCheck.trim());
  const hasSearch = !!(keys.search && keys.search.trim() && keys.searchId && keys.searchId.trim());

  const configuredCount = [hasGemini, hasFactCheck, hasSearch].filter(Boolean).length;
  const totalKeys = 3; // Gemini, FactCheck, Search (Search has 2 fields but counts as 1)

  return {
    hasGemini,
    hasFactCheck,
    hasSearch,
    isFullyConfigured: configuredCount === totalKeys,
    configuredCount,
    totalKeys
  };
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKeyFormat(key: string, type: 'gemini' | 'google'): { valid: boolean; error?: string } {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'API key cannot be empty' };
  }

  if (key.length < 20) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  if (type === 'gemini') {
    // Gemini keys typically start with 'AI' and are about 39 characters
    if (!key.startsWith('AI')) {
      return { valid: false, error: 'Gemini API keys typically start with "AI"' };
    }
  }

  return { valid: true };
}

/**
 * Export API keys (for backup)
 */
export function exportApiKeys(): string {
  const keys = getApiKeys();
  return JSON.stringify(keys, null, 2);
}

/**
 * Import API keys (from backup)
 */
export function importApiKeys(jsonString: string): { success: boolean; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Invalid JSON structure' };
    }

    setApiKeys(parsed);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse JSON'
    };
  }
}

// Gemini-specific helpers
export function getGeminiApiKey(): string {
  return getApiKey('gemini');
}

export function getGeminiModel(): string {
  return getApiKey('geminiModel') || 'gemini-1.5-flash-latest';
}

export function setGeminiApiKey(key: string): void {
  setApiKey('gemini', key);
}

export function setGeminiModel(model: string): void {
  setApiKey('geminiModel', model);
}

// Google Fact Check helpers
export function getFactCheckApiKey(): string {
  return getApiKey('factCheck');
}

export function setFactCheckApiKey(key: string): void {
  setApiKey('factCheck', key);
}

// Google Search helpers
export function getSearchApiKey(): string {
  return getApiKey('search');
}

export function getSearchId(): string {
  return getApiKey('searchId');
}

export function setSearchApiKey(key: string): void {
  setApiKey('search', key);
}

export function setSearchId(id: string): void {
  setApiKey('searchId', id);
}