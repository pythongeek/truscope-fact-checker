import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  onClear: () => void;
  hasExistingKey: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, onClear, hasExistingKey }) => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Your Gemini API Key</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-slate-400 mb-4 text-sm">
          Your API key is stored securely in your browser's local storage and is never sent to our servers.
        </p>
        <div className="space-y-4">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API Key"
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-secondary"
          />
          <div className="flex justify-between items-center">
            {hasExistingKey ? (
              <button
                onClick={onClear}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Clear Key
              </button>
            ) : <div />}
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="px-6 py-2 bg-brand-secondary hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed"
            >
              Save Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
