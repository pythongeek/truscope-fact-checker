import React, { useState, useEffect } from 'react';
import { XCircleIcon } from './icons';
import { setApiKeys, getApiKeys } from '../services/apiKeyService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const API_KEY_FIELDS = [
    { id: 'gemini', label: 'Gemini API Key', group: 'Google APIs', url: 'https://aistudio.google.com/', type: 'password' },
    { id: 'geminiModel', label: 'Gemini Model', group: 'Google APIs', type: 'select', options: ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-pro'] },
    { id: 'factCheck', label: 'Google Fact Check Tools API Key', group: 'Google APIs', url: 'https://developers.google.com/custom-search/v1/overview', type: 'password' },
    { id: 'search', label: 'Google Search API Key', group: 'Google APIs', url: 'https://developers.google.com/custom-search/v1/overview', type: 'password' },
    { id: 'searchId', label: 'Google Search ID', group: 'Google APIs', url: 'https://developers.google.com/custom-search/v1/overview', type: 'password' },
    { id: 'newsdata', label: 'newsdata.io API Key', group: 'Third-Party APIs', url: 'https://newsdata.io/free-news-api', type: 'password' },
    { id: 'serp', label: 'SERP API Key', group: 'Third-Party APIs', url: 'https://serphouse.com/', type: 'password' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [keys, setKeys] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            setKeys(getApiKeys());
        }
    }, [isOpen]);

    const handleSave = () => {
        setApiKeys(keys);
        onClose();
    };

    const handleInputChange = (id: string, value: string) => {
        setKeys(prev => ({ ...prev, [id]: value }));
    };

    if (!isOpen) {
        return null;
    }

    const groupedFields = API_KEY_FIELDS.reduce((acc, field) => {
        acc[field.group] = acc[field.group] || [];
        acc[field.group].push(field);
        return acc;
    }, {} as Record<string, typeof API_KEY_FIELDS>);

    return (
        <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl shadow-xl p-6 w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between">
                    <h2 id="modal-title" className="text-xl font-bold text-slate-100">Settings</h2>
                    <button onClick={onClose} className="text-slate-300 hover:text-slate-200 transition-colors" aria-label="Close settings">
                        <XCircleIcon className="w-7 h-7" />
                    </button>
                </div>
                
                <div className="mt-6 space-y-6">
                    {Object.entries(groupedFields).map(([groupName, fields]) => (
                        <div key={groupName}>
                            <h3 className="text-base font-semibold text-indigo-400 mb-3">{groupName}</h3>
                            <div className="space-y-4">
                                {fields.map(field => (
                                    <div key={field.id}>
                                        <label htmlFor={field.id} className="block text-sm font-medium text-slate-300 mb-1">
                                            {field.label}
                                        </label>
                                        {field.type === 'select' ? (
                                            <select
                                                id={field.id}
                                                value={keys[field.id] || ''}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                                className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200"
                                            >
                                                {field.options?.map(option => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="password"
                                                id={field.id}
                                                value={keys[field.id] || ''}
                                                onChange={(e) => handleInputChange(field.id, e.target.value)}
                                                placeholder={`Enter your ${field.label}`}
                                                className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200 placeholder-slate-400"
                                            />
                                        )}
                                        {field.url && (
                                            <p className="mt-2 text-xs text-slate-400">
                                                Get your free API key from <a href={field.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{field.url}</a>
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    <p className="mt-4 text-xs text-slate-400 text-center">
                        Your API keys are stored securely in your browser's local storage and are never sent to our servers.
                    </p>
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
                        className="px-5 py-2 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;