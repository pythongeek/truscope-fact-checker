import React, { useState, useEffect } from 'react';
import { testGeminiKey } from '@/services/apiKeyService';

interface ApiKeys {
    gemini?: string;
    geminiModel?: string;
    factCheck?: string;
    search?: string;
    searchId?: string;
}

interface ApiKeySettingsProps {
    currentKeys: ApiKeys;
    onSave: (newKeys: ApiKeys) => void;
    availableModels: string[];
    isLoadingModels: boolean;
    onClose: () => void;
}

export function ApiKeySettings({
    currentKeys,
    onSave,
    availableModels,
    isLoadingModels,
    onClose,
}: ApiKeySettingsProps) {
    const [keys, setKeys] = useState<ApiKeys>(currentKeys);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null);

    useEffect(() => {
        setKeys(currentKeys);
    }, [currentKeys]);

    const handleSave = () => {
        onSave(keys);
        onClose(); // Close modal on save
    };

    const handleTestGemini = async () => {
        if (!keys.gemini) {
            alert('Please enter a Gemini API key first');
            return;
        }

        setTesting(true);
        setTestResult(null);
        try {
            const isValid = await testGeminiKey(keys.gemini);
            setTestResult(isValid ? 'success' : 'failure');
            if (isValid) {
                setTimeout(() => setTestResult(null), 3000); // Reset after 3s
            }
        } catch (error) {
            setTestResult('failure');
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Gemini API Key */}
            <div>
                <label className="block text-sm font-medium mb-2">
                    Gemini API Key *
                </label>
                <div className="flex items-center space-x-2">
                    <input
                        type="password"
                        value={keys.gemini || ''}
                        onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
                        className="flex-grow px-4 py-2 border rounded"
                        placeholder="AIza..."
                    />
                    <button
                        onClick={handleTestGemini}
                        disabled={testing || !keys.gemini}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                        {testing ? 'Testing...' : 'Test'}
                    </button>
                </div>
                {testResult === 'success' && <p className="text-sm text-green-500 mt-1">✅ Connection successful!</p>}
                {testResult === 'failure' && <p className="text-sm text-red-500 mt-1">❌ Connection failed. Please check your key.</p>}
            </div>

            {/* Gemini Model Selection */}
            <div>
                <label htmlFor="geminiModel" className="block text-sm font-medium mb-2">
                    Gemini Model
                </label>
                <select
                    id="geminiModel"
                    name="geminiModel"
                    value={keys.geminiModel || ''}
                    onChange={(e) => setKeys({ ...keys, geminiModel: e.target.value })}
                    disabled={isLoadingModels || availableModels.length === 0}
                    className="w-full px-4 py-2 border rounded"
                >
                    {isLoadingModels ? (
                        <option>Loading models...</option>
                    ) : (
                        availableModels.map(model => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))
                    )}
                </select>
                 <p className="text-sm text-gray-500 mt-1">Select a model. `gemini-1.5-flash-latest` is recommended for speed.</p>
            </div>

            {/* Other API Keys */}
            <div>
                <label className="block text-sm font-medium mb-2">
                    Google Fact Check API Key
                </label>
                <input
                    type="password"
                    value={keys.factCheck || ''}
                    onChange={(e) => setKeys({ ...keys, factCheck: e.target.value })}
                    className="w-full px-4 py-2 border rounded"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">
                    Google Search API Key
                </label>
                <input
                    type="password"
                    value={keys.search || ''}
                    onChange={(e) => setKeys({ ...keys, search: e.target.value })}
                    className="w-full px-4 py-2 border rounded"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">
                    Google Search Engine ID
                </label>
                <input
                    type="text"
                    value={keys.searchId || ''}
                    onChange={(e) => setKeys({ ...keys, searchId: e.target.value })}
                    className="w-full px-4 py-2 border rounded"
                />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={onClose}
                    type="button"
                    className="px-6 py-2 border rounded-md text-gray-700 mr-2"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
}
