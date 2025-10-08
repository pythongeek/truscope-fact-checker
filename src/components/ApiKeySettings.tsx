import React, { useState, useEffect } from 'react';
import { saveApiKeys, getApiKeys, testGeminiKey, fetchGeminiModels } from '@/services/apiKeyService';
import { listGeminiModels } from '@/services/geminiService';

export function ApiKeySettings() {
  const [keys, setKeys] = useState(getApiKeys());
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
      const loadModels = async () => {
        if (keys.gemini) {
          setIsLoadingModels(true);
          const models = await fetchGeminiModels(keys.gemini);
          setGeminiModels(models);
          setIsLoadingModels(false);
        }
      };
      loadModels();
    }, [keys.gemini]);

  const handleSave = async () => {
    try {
      saveApiKeys(keys);
      alert('API keys saved successfully!');
    } catch (error) {
      alert('Failed to save API keys');
    }
  };

  const handleTestGemini = async () => {
    if (!keys.gemini) {
      alert('Please enter a Gemini API key first');
      return;
    }

    setTesting(true);
    try {
      const isValid = await testGeminiKey(keys.gemini);
      if (isValid) {
        alert('✅ Gemini API key is valid!');
        // Fetch available models
        const availableModels = await listGeminiModels();
        setModels(availableModels);
      } else {
        alert('❌ Gemini API key is invalid');
      }
    } catch (error) {
      alert('Failed to test API key');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">API Configuration</h2>

      {/* Gemini API Key */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Gemini API Key *
        </label>
        <input
          type="password"
          value={keys.gemini || ''}
          onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
          className="w-full px-4 py-2 border rounded"
          placeholder="AIza..."
        />
        <p className="text-sm text-gray-500 mt-1">
          Get your API key: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600">
            https://aistudio.google.com/app/apikey
          </a>
        </p>
        <button
          onClick={handleTestGemini}
          disabled={testing || !keys.gemini}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Gemini Model Selection */}
      <div>
        <label htmlFor="geminiModel" className="block text-sm font-medium mb-2">
          Gemini Model
        </label>
        <select
          id="geminiModel"
          name="geminiModel"
          value={keys.geminiModel}
          onChange={(e) => setKeys({ ...keys, geminiModel: e.target.value })}
          disabled={isLoadingModels || geminiModels.length === 0}
          className="w-full px-4 py-2 border rounded"
        >
          {isLoadingModels ? (
            <option>Loading models...</option>
          ) : (
            geminiModels.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Google Fact Check API Key */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Google Fact Check Tools API Key *
        </label>
        <input
          type="password"
          value={keys.factCheck || ''}
          onChange={(e) => setKeys({ ...keys, factCheck: e.target.value })}
          className="w-full px-4 py-2 border rounded"
          placeholder="AIza..."
        />
        <p className="text-sm text-gray-500 mt-1">
          Enable API: <a href="https://console.cloud.google.com/apis/library/factchecktools.googleapis.com" target="_blank" className="text-blue-600">
            Google Cloud Console
          </a>
        </p>
      </div>

      {/* Google Search API Key */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Google Search API Key *
        </label>
        <input
          type="password"
          value={keys.search || ''}
          onChange={(e) => setKeys({ ...keys, search: e.target.value })}
          className="w-full px-4 py-2 border rounded"
          placeholder="AIza..."
        />
        <p className="text-sm text-gray-500 mt-1">
          Enable API: <a href="https://console.cloud.google.com/apis/library/customsearch.googleapis.com" target="_blank" className="text-blue-600">
            Google Cloud Console
          </a>
        </p>
      </div>

      {/* Search Engine ID */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Google Search Engine ID *
        </label>
        <input
          type="text"
          value={keys.searchId || ''}
          onChange={(e) => setKeys({ ...keys, searchId: e.target.value })}
          className="w-full px-4 py-2 border rounded"
          placeholder="Your Search Engine ID"
        />
        <p className="text-sm text-gray-500 mt-1">
          Create search engine: <a href="https://programmablesearchengine.google.com/" target="_blank" className="text-blue-600">
            Programmable Search Engine
          </a>
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Save API Keys
      </button>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 rounded">
        <p className="text-sm text-blue-800">
          <strong>Privacy Notice:</strong> Your API keys are stored locally in your browser and never sent to our servers.
          They are only used to make direct API calls to Google services.
        </p>
      </div>
    </div>
  );
}