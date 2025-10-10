// src/components/SettingsModal.tsx

import React, { useState, useEffect } from 'react';
import { ApiKeys } from '../types'; // Make sure this path is correct
import { Info, Loader, Save, X } from 'lucide-react';

// Define the props for the component
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
  currentKeys: ApiKeys;
  availableModels: string[];
  isLoadingModels: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  currentKeys,
  availableModels,
  isLoadingModels,
}: SettingsModalProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeys>(currentKeys);

  // Update local state if the props from parent change
  useEffect(() => {
    setApiKeys(currentKeys);
  }, [currentKeys]);

  if (!isOpen) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setApiKeys(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveClick = () => {
    onSave(apiKeys);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">API Configuration</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Gemini API Key */}
          <div>
            <label htmlFor="gemini" className="block text-sm font-medium text-gray-700 mb-1">
              Gemini API Key
            </label>
            <input
              type="password"
              id="gemini"
              name="gemini"
              value={apiKeys.gemini || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your Google AI Studio Key"
            />
             <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1">
              Get your API key from AI Studio
            </a>
          </div>

          {/* Gemini Model Dropdown */}
          <div>
            <label htmlFor="geminiModel" className="block text-sm font-medium text-gray-700 mb-1">
              Gemini Model
            </label>
            <div className="relative">
              <select
                id="geminiModel"
                name="geminiModel"
                value={apiKeys.geminiModel || ''}
                onChange={handleInputChange}
                disabled={isLoadingModels || !apiKeys.gemini}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 appearance-none disabled:bg-gray-100"
              >
                {isLoadingModels ? (
                  <option>Loading models...</option>
                ) : (
                  <>
                    {availableModels.length > 0 ? (
                      availableModels.map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))
                    ) : (
                      <option>Enter Gemini key to see models</option>
                    )}
                  </>
                )}
              </select>
              {isLoadingModels && <Loader className="animate-spin absolute right-3 top-2.5 text-gray-400" size={20}/>}
            </div>
          </div>

          {/* Google Fact Check API Key */}
          <div>
            <label htmlFor="factCheck" className="block text-sm font-medium text-gray-700 mb-1">
              Google Fact Check API Key
            </label>
            <input
              type="password"
              id="factCheck"
              name="factCheck"
              value={apiKeys.factCheck || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your Google Fact Check API Key"
            />
          </div>

          {/* Google Search API Key */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Google Search API Key
            </label>
            <input
              type="password"
              id="search"
              name="search"
              value={apiKeys.search || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your Google Search API Key"
            />
          </div>

          {/* Google Search Engine ID */}
          <div>
            <label htmlFor="searchId" className="block text-sm font-medium text-gray-700 mb-1">
              Google Search Engine ID
            </label>
            <input
              type="text"
              id="searchId"
              name="searchId"
              value={apiKeys.searchId || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your Google Search Engine ID"
            />
          </div>

        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 flex items-center"
          >
            <Save size={18} className="mr-2" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
