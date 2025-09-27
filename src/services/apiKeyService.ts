const API_KEYS_CONFIG = {
    gemini: 'gemini_api_key',
    geminiModel: 'gemini_model', // Added for model selection
    factCheck: 'fact_check_api_key',
    search: 'search_api_key',
    searchId: 'search_id',
    newsdata: 'newsdata_api_key',
    serp: 'serp_api_key',
};

type ApiKeyId = keyof typeof API_KEYS_CONFIG;

// --- Getters with Error Handling ---

function getKeyFromStorage(keyId: ApiKeyId, errorMessage: string): string {
    const storageKey = API_KEYS_CONFIG[keyId];
    const apiKey = localStorage.getItem(storageKey);
    if (!apiKey) {
        throw new Error(errorMessage);
    }
    return apiKey;
}

export const getGeminiApiKey = (): string => {
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envApiKey) {
        return envApiKey;
    }
    return getKeyFromStorage('gemini', 'Gemini API key not found. Please set it in the .env file or in the Settings panel.');
};

export const getGeminiModel = (): string => {
    const storedModel = localStorage.getItem(API_KEYS_CONFIG.geminiModel);
    return storedModel || 'gemini-1.5-flash-latest'; // Default model
};

export const getFactCheckApiKey = (): string =>
    getKeyFromStorage('factCheck', 'Google Fact Check API key not found. Please add it in Settings.');

export const getSearchApiKey = (): string =>
    getKeyFromStorage('search', 'Google Search API key not found. Please add it in Settings.');
    
export const getSearchId = (): string =>
    getKeyFromStorage('searchId', 'Google Search ID not found. Please add it in Settings.');

export const getNewsDataApiKey = (): string =>
    getKeyFromStorage('newsdata', 'newsdata.io API key not found. Please add it in Settings.');

export const getSerpApiKey = (): string =>
    getKeyFromStorage('serp', 'SERP API key not found. Please add it in Settings.');


// --- Bulk Getters/Setters for Settings UI ---

export const getApiKeys = (): Record<string, string> => {
    const keys: Record<string, string> = {};
    for (const key in API_KEYS_CONFIG) {
        const storageKey = API_KEYS_CONFIG[key as ApiKeyId];
        keys[key] = localStorage.getItem(storageKey) || '';
    }
    return keys;
};

export const setApiKeys = (keys: Record<string, string>): void => {
    for (const key in keys) {
        if (API_KEYS_CONFIG[key as ApiKeyId]) {
            const storageKey = API_KEYS_CONFIG[key as ApiKeyId];
            localStorage.setItem(storageKey, keys[key]);
        }
    }
};


// --- Validation ---

/**
 * Checks if all required API keys are present in local storage.
 * @returns {boolean} True if all keys are provided, false otherwise.
 */
export const areAllKeysProvided = (): boolean => {
    for (const key in API_KEYS_CONFIG) {
        const storageKey = API_KEYS_CONFIG[key as ApiKeyId];
        if (!localStorage.getItem(storageKey)) {
            console.warn(`Validation failed: Missing API key for '${key}'`);
            return false;
        }
    }
    return true;
};
