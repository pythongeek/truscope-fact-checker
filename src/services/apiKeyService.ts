// src/services/apiKeyService.ts - Manages user API keys in browser storage
export interface ApiKeyConfig {
  gemini: string;              // Gemini AI Studio API key
  geminiModel: string;         // Selected Gemini model
  factCheck: string;           // Google Fact Check Tools API key
  search: string;              // Google Search API key
  searchId: string;            // Google Search Engine ID
}

const STORAGE_KEY = 'truscope_api_keys';

/**
 * Get stored API keys from localStorage
 */
export function getApiKeys(): Partial<ApiKeyConfig> {
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
}

/**
 * Save API keys to localStorage
 */
export function saveApiKeys(keys: Partial<ApiKeyConfig>): void {
  try {
    const existing = getApiKeys();
    const updated = { ...existing, ...keys };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log('💾 API keys saved to storage');
  } catch (error) {
    console.error('Failed to save API keys:', error);
    throw new Error('Failed to save API keys. Please try again.');
  }
}

/**
 * Clear all stored API keys
 */
export function clearApiKeys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ API keys cleared from storage');
  } catch (error) {
    console.error('Failed to clear API keys:', error);
  }
}

/**
 * Check if API keys are configured
 */
export function hasApiKeys(): boolean {
  const keys = getApiKeys();
  return !!(keys.gemini && keys.factCheck && keys.search && keys.searchId);
}

/**
 * Check if required API keys are configured
 */
export function areRequiredKeysConfigured(): boolean {
    const keys = getApiKeys();
    return !!keys.gemini;
}

/**
 * Get API key configuration status
 */
export function getApiKeyStatus(): {
  gemini: boolean;
  geminiModel: boolean;
  factCheck: boolean;
  search: boolean;
  searchId: boolean;
  allConfigured: boolean;
} {
  const keys = getApiKeys();
  
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
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKey(key: string, type: keyof ApiKeyConfig): {
  valid: boolean;
  error?: string;
} {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  switch (type) {
    case 'gemini':
      // Gemini API keys typically start with "AIza"
      if (!key.startsWith('AIza')) {
        return { 
          valid: false, 
          error: 'Gemini API keys typically start with "AIza". Please verify your key.' 
        };
      }
      break;
    
    case 'factCheck':
    case 'search':
      // Google API keys typically start with "AIza"
      if (!key.startsWith('AIza')) {
        return { 
          valid: false, 
          error: 'Google API keys typically start with "AIza". Please verify your key.' 
        };
      }
      break;
    
    case 'searchId':
      // Search Engine IDs are alphanumeric
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return { 
          valid: false, 
          error: 'Search Engine ID should be alphanumeric.' 
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Test if a Gemini API key is valid
 */
export async function testGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Test' }]
          }],
          generationConfig: {
            maxOutputTokens: 5
          }
        })
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('Gemini key test failed:', error);
    return false;
  }
}

/**
 * Test if a Google API key is valid (Fact Check or Search)
 */
export async function testGoogleKey(apiKey: string, type: 'factCheck' | 'search'): Promise<boolean> {
  try {
    let url: string;
    
    if (type === 'factCheck') {
      url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=test&key=${apiKey}`;
    } else {
      // For search, we need both API key and Search Engine ID
      // This is a basic test - full validation requires Search Engine ID
      url = `https://www.googleapis.com/customsearch/v1?q=test&key=${apiKey}`;
    }
    
    const response = await fetch(url);
    
    // 400 is OK - means API key is valid but request parameters might be wrong
    // 403 means API key is invalid or unauthorized
    return response.ok || response.status === 400;
  } catch (error) {
    console.error(`${type} key test failed:`, error);
    return false;
  }
}

/**
 * Export API keys configuration for debugging (masks sensitive data)
 */
export function exportApiKeyConfig(): Record<string, string> {
  const keys = getApiKeys();
  
  return {
    gemini: keys.gemini ? `${keys.gemini.substring(0, 8)}...` : 'Not configured',
    geminiModel: keys.geminiModel || 'Not configured',
    factCheck: keys.factCheck ? `${keys.factCheck.substring(0, 8)}...` : 'Not configured',
    search: keys.search ? `${keys.search.substring(0, 8)}...` : 'Not configured',
    searchId: keys.searchId ? `${keys.searchId.substring(0, 8)}...` : 'Not configured',
  };
}
