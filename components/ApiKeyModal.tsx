import React, { useState, useEffect } from 'react';
import { XCircleIcon, EyeIcon, EyeSlashIcon, KeyIcon } from './icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  onClear: () => void;
  hasExistingKey: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onClear,
  hasExistingKey
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey('');
      setIsEditing(!hasExistingKey);
      setValidationError(null);
      setShowApiKey(false);
    }
  }, [isOpen, hasExistingKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditing) {
      setIsEditing(true);
    }
    setApiKey(e.target.value);
  };

  const validateApiKey = (key: string): boolean => {
    // Basic validation for Gemini API key format
    return key.startsWith('AIza') && key.length >= 35;
  };

  const handleSave = async () => {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setValidationError('Please enter an API key');
      return;
    }

    if (!validateApiKey(trimmedKey)) {
      setValidationError('Invalid API key format. Gemini API keys should start with "AIza" and be at least 35 characters long.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Test the API key with a simple request
      const response = await fetch('https://generativelanguage.googleapis.com/v1/models?key=' + trimmedKey);

      if (!response.ok) {
        if (response.status === 400) {
          throw new Error('Invalid API key. Please check your key and try again.');
        } else if (response.status === 403) {
          throw new Error('API key does not have permission to access Gemini API.');
        } else {
          throw new Error('Failed to validate API key. Please try again.');
        }
      }

      onSave(trimmedKey);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to validate API key');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    onClear();
    setApiKey('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <KeyIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-slate-100">
              {hasExistingKey ? 'Update API Key' : 'Add Your Gemini API Key'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-slate-300 text-sm mb-4">
              Add your own Google Gemini API key to remove usage limits and ensure your requests are processed using your own quota.
            </p>

            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3 mb-4">
              <p className="text-blue-200 text-sm">
                <strong>How to get your API key:</strong>
              </p>
              <ol className="text-blue-200 text-sm mt-2 space-y-1 list-decimal list-inside">
                <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a></li>
                <li>Sign in with your Google account</li>
                <li>Click "Create API Key"</li>
                <li>Copy the generated key</li>
              </ol>
            </div>

            <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-300 mb-2">
              Gemini API Key
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showApiKey ? 'text' : 'password'}
                value={isEditing ? apiKey : 'AIza...•••••••••••••••••••••'}
                onChange={handleInputChange}
                onFocus={() => !isEditing && setApiKey('')}
                placeholder="AIza..."
                className="w-full px-4 py-3 bg-slate-900/70 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-200 pr-12 font-mono text-sm"
                disabled={isValidating}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {validationError && (
            <div className="bg-red-900/50 border border-red-600 text-red-300 px-3 py-2 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          <div className="bg-slate-900/50 border border-slate-600/50 rounded-lg p-3">
            <p className="text-slate-400 text-xs">
              <strong>Security:</strong> Your API key is stored locally in your browser and never sent to our servers.
              It's used directly to communicate with Google's Gemini API.
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            {hasExistingKey && (
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Remove Key
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isValidating || !apiKey.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {isValidating ? 'Validating...' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
