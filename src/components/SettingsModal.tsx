import React, { useState, useEffect } from 'react';
import { XCircleIcon } from './icons';
import { setApiKeys, getApiKeys } from '../services/apiKeyService';
import { ApiKeys, ApiKeyConfig } from '@/types/apiKeys';
import { listGeminiModels } from '../services/geminiService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FALLBACK_GEMINI_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-2.0-flash-exp',
    'gemini-pro',
    'gemini-1.0-pro',
];

const API_KEY_FIELDS: ApiKeyConfig[] = [
    { 
        id: 'gemini', 
        label: 'Gemini API Key', 
        group: 'Google APIs', 
        url: 'https://aistudio.google.com/', 
        type: 'password',
        description: 'Used for AI-powered fact-check synthesis and analysis'
    },
    { 
        id: 'geminiModel', 
        label: 'Gemini Model', 
        group: 'Google APIs', 
        type: 'select', 
        options: [],
        description: 'Select the AI model to use for analysis'
    },
    { 
        id: 'factCheck', 
        label: 'Google Fact Check Tools API Key', 
        group: 'Google APIs', 
        url: 'https://developers.google.com/custom-search/v1/overview', 
        type: 'password',
        description: 'For direct fact-check verification (Phase 1)'
    },
    { 
        id: 'search', 
        label: 'Google Search API Key', 
        group: 'Google APIs', 
        url: 'https://developers.google.com/custom-search/v1/overview', 
        type: 'password',
        description: 'For web search capabilities'
    },
    { 
        id: 'searchId', 
        label: 'Google Search Engine ID', 
        group: 'Google APIs', 
        url: 'https://developers.google.com/custom-search/v1/overview', 
        type: 'password',
        description: 'Custom Search Engine ID for Google Search'
    },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [keys, setKeys] = useState<Record<string, string>>({});
    const [geminiModels, setGeminiModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const currentKeys = getApiKeys();
            // Convert ApiKeys to Record<string, string> for state management
            const keysRecord: Record<string, string> = {
                gemini: currentKeys.gemini || '',
                geminiModel: currentKeys.geminiModel || '',
                factCheck: currentKeys.factCheck || '',
                search: currentKeys.search || '',
                searchId: currentKeys.searchId || ''
            };
            setKeys(keysRecord);
            
            // Set default model if not set
            if (!keysRecord.geminiModel) {
                setKeys(prev => ({ ...prev, geminiModel: FALLBACK_GEMINI_MODELS[0] }));
            }

            fetchModels();
        }
    }, [isOpen]);

    const fetchModels = async () => {
        setIsLoadingModels(true);
        setModelError(null);
        try {
            const models = await listGeminiModels();
            if (models.length > 0) {
                setGeminiModels(models);
                console.log('✅ Successfully loaded Gemini models:', models);
            } else {
                setGeminiModels(FALLBACK_GEMINI_MODELS);
                setModelError("Could not fetch model list. Using fallback options.");
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            setGeminiModels(FALLBACK_GEMINI_MODELS);
            setModelError("Failed to fetch model list. Using fallback options.");
        } finally {
            setIsLoadingModels(false);
        }
    };

    const handleSave = () => {
        // Validate that at least Gemini API key is provided
        if (!keys.gemini || keys.gemini.trim() === '') {
            alert('Gemini API Key is required for the application to function properly.');
            return;
        }

        // Convert Record<string, string> back to ApiKeys type
        const apiKeys: ApiKeys = {
            gemini: keys.gemini,
            geminiModel: keys.geminiModel,
            factCheck: keys.factCheck,
            search: keys.search,
            searchId: keys.searchId
        };

        setApiKeys(apiKeys);
        setSaveSuccess(true);
        
        console.log('✅ API keys saved successfully');
        console.log('📋 Configured APIs:', Object.keys(keys).filter(k => keys[k]));
        
        setTimeout(() => {
            setSaveSuccess(false);
            onClose();
        }, 1500);
    };

    const handleInputChange = (id: string, value: string) => {
        setKeys(prev => ({ ...prev, [id]: value }));
    };

    const testGeminiConnection = async () => {
        if (!keys.gemini) {
            alert('Please enter a Gemini API key first');
            return;
        }

        setIsLoadingModels(true);
        try {
            // Simple test call to Gemini API
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${keys.gemini}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: 'Hello' }]
                        }]
                    })
                }
            );

            if (response.ok) {
                alert('✅ Gemini API connection successful!');
            } else {
                const error = await response.json();
                alert(`❌ Gemini API test failed: ${error.error?.message || 'Unknown error'}`);
            }
        } catch (error) {
            alert(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoadingModels(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    const groupedFields = API_KEY_FIELDS.reduce((acc, field) => {
        if (!acc[field.group]) {
            acc[field.group] = [];
        }
        acc[field.group].push(field);
        return acc;
    }, {} as Record<string, ApiKeyConfig[]>);

    return (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl shadow-xl p-6 w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 id="modal-title" className="text-xl font-bold text-slate-100">API Configuration</h2>
                        <p className="text-sm text-slate-400 mt-1">Configure your API keys for enhanced fact-checking</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-300 hover:text-slate-200 transition-colors" 
                        aria-label="Close settings"
                    >
                        <XCircleIcon className="w-7 h-7" />
                    </button>
                </div>
                
                {saveSuccess && (
                    <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg">
                        <p className="text-green-400 text-sm font-medium">✅ Settings saved successfully!</p>
                    </div>
                )}

                <div className="space-y-6">
                    {Object.entries(groupedFields).map(([groupName, fields]) => (
                        <div key={groupName} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                            <h3 className="text-base font-semibold text-indigo-400 mb-4 flex items-center">
                                <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>
                                {groupName}
                            </h3>
                            <div className="space-y-4">
                                {fields.map(field => (
                                    <div key={field.id}>
                                        <label htmlFor={field.id} className="block text-sm font-medium text-slate-300 mb-2">
                                            {field.label}
                                            {field.id === 'gemini' && <span className="text-red-400 ml-1">*</span>}
                                        </label>
                                        {field.type === 'select' ? (
                                            <>
                                                <select
                                                    id={field.id}
                                                    value={keys[field.id] || ''}
                                                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                                                    className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200"
                                                    disabled={isLoadingModels}
                                                >
                                                    {isLoadingModels ? (
                                                        <option>Loading models...</option>
                                                    ) : (
                                                        geminiModels.map(option => (
                                                            <option key={option} value={option}>{option}</option>
                                                        ))
                                                    )}
                                                </select>
                                                {modelError && (
                                                    <p className="mt-2 text-xs text-amber-400">{modelError}</p>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className="relative">
                                                    <input
                                                        type="password"
                                                        id={field.id}
                                                        value={keys[field.id] || ''}
                                                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                                                        placeholder={`Enter your ${field.label}`}
                                                        className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200 placeholder-slate-400"
                                                    />
                                                    {field.id === 'gemini' && keys.gemini && (
                                                        <button
                                                            onClick={testGeminiConnection}
                                                            disabled={isLoadingModels}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
                                                        >
                                                            Test
                                                        </button>
                                                    )}
                                                </div>
                                                {field.description && (
                                                    <p className="mt-1 text-xs text-slate-500">{field.description}</p>
                                                )}
                                            </>
                                        )}
                                        {field.url && (
                                            <p className="mt-2 text-xs text-slate-400">
                                                Get your API key: <a 
                                                    href={field.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-indigo-400 hover:underline"
                                                >
                                                    {field.url}
                                                </a>
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <h4 className="text-sm font-semibold text-blue-400 mb-1">Privacy & Security</h4>
                                <p className="text-xs text-slate-400">
                                    Your API keys are stored securely in your browser's local storage and are sent directly to 
                                    the respective API services. They are never stored on our servers. The keys are used to 
                                    authenticate your requests and enable advanced fact-checking features.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2 font-semibold text-slate-200 bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!keys.gemini}
                        className="px-5 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
