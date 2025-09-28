import React, { useState } from 'react';
import { ShieldCheckIcon } from './icons';
import { MethodSelector } from './MethodSelector';
import { FactCheckMethod, UserCategory } from '../types/factCheck';

interface InputSectionProps {
    inputText: string;
    onTextChange: (text: string) => void;
    onAnalyze: (method: FactCheckMethod) => void;
    isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ inputText, onTextChange, onAnalyze, isLoading }) => {
    const [selectedMethod, setSelectedMethod] = useState<FactCheckMethod>('comprehensive');
    const [userCategory, setUserCategory] = useState<UserCategory>('general');

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
            <div className="relative">
                <textarea
                    value={inputText}
                    onChange={(e) => onTextChange(e.target.value)}
                    placeholder="Example: 'Climate change is primarily caused by human activities according to 97% of scientists'"
                    className="w-full h-48 p-4 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200 placeholder-slate-400 resize-y"
                    disabled={isLoading}
                    aria-label="Content to analyze"
                    maxLength={10000}
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                    {inputText.length} / 10000
                </div>
            </div>
            <div className="mt-6">
                <MethodSelector
                    selectedMethod={selectedMethod}
                    onMethodChange={setSelectedMethod}
                    userCategory={userCategory}
                    onUserCategoryChange={setUserCategory}
                />
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => onAnalyze(selectedMethod)}
                    disabled={isLoading}
                    className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <ShieldCheckIcon className="w-5 h-5"/>
                            Verify Claims
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default InputSection;