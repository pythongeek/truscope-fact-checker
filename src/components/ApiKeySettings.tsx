import React from 'react';

// This is a placeholder component. The full implementation should be provided later.
const ApiKeySettings = ({ onClose }: { onClose: () => void }) => {
  const saveApiKeys = () => {
    // Placeholder function
    console.log("Saving API keys...");
    onClose();
  };

  const clearApiKeys = () => {
    // Placeholder function
    console.log("Clearing API keys...");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">API Key Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        <div className="space-y-4">
          {/* Placeholder for API key input fields */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Gemini API Key</label>
            <input type="password" placeholder="Enter your Gemini API key" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Google Search API Key</label>
            <input type="password" placeholder="Enter your Google Search API key" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">NewsAPI Key</label>
            <input type="password" placeholder="Enter your NewsAPI key" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white" />
          </div>
        </div>
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={clearApiKeys}
            className="px-4 py-2 text-sm font-medium text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            Clear All Keys
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveApiKeys}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
