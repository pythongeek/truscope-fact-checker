import React from 'react';
import { XCircleIcon } from './icons';
import { ApiKeySettings } from './ApiKeySettings';

interface ApiKeys {
    gemini?: string;
    geminiModel?: string;
    factCheck?: string;
    search?: string;
    searchId?: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (newKeys: ApiKeys) => void;
    currentKeys: ApiKeys;
    availableModels: string[];
    isLoadingModels: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentKeys,
    availableModels,
    isLoadingModels,
}) => {
    if (!isOpen) {
        return null;
    }

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

                <ApiKeySettings
                    currentKeys={currentKeys}
                    onSave={onSave}
                    availableModels={availableModels}
                    isLoadingModels={isLoadingModels}
                    onClose={onClose}
                />

            </div>
        </div>
    );
};

export default SettingsModal;
