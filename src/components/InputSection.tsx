import React, { useState } from 'react';
import { ShieldCheckIcon } from './icons';

export type AnalysisMethod = 'gemini-only' | 'google-ai' | 'hybrid' | 'citation-augmented' | 'newsdata' | 'temporal-focus' | 'source-priority';

interface InputSectionProps {
    inputText: string;
    onTextChange: (text: string) => void;
    onAnalyze: (method: AnalysisMethod) => void;
    isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ inputText, onTextChange, onAnalyze, isLoading }) => {
    const [selectedMethod, setSelectedMethod] = useState<AnalysisMethod>('citation-augmented');

    return (
        <div className="bg-slate-800/50 p-6 rounded-2xl shadow-lg">
            <div className="relative">
                <textarea
                    value={inputText}
                    onChange={(e) => onTextChange(e.target.value)}
                    placeholder="Example: 'Climate change is primarily caused by human activities according to 97% of scientists'"
                    className="w-full h-64 p-4 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-slate-200 placeholder-slate-400 resize-y"
                    disabled={isLoading}
                    aria-label="Content to analyze"
                    maxLength={10000}
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                    {inputText.length} / 10000
                </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <label htmlFor="analysis-method" className="block text-sm font-medium text-slate-300 mb-1">
                        Analysis Method
                    </label>
                    <select
                        id="analysis-method"
                        value={selectedMethod}
                        onChange={(e) => setSelectedMethod(e.target.value as AnalysisMethod)}
                        disabled={isLoading}
                        className="bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors w-full sm:w-auto"
                    >
                        <option value="citation-augmented">📚 Citation-Augmented Analysis (Recommended)</option>
                        <option value="hybrid">🔄 Comprehensive Analysis</option>
                        <option value="google-ai">🔧 Tool-Based Verification</option>
                        <option value="newsdata">📰 Recent News Coverage</option>
                        <option value="gemini-only">🧠 Core AI Analysis</option>
                        <option value="temporal-focus">⏰ Temporal-Focused Analysis (NEW)</option>
                        <option value="source-priority">📊 Source-Priority Analysis (NEW)</option>
                    </select>

                    <div className="mt-2 text-xs text-slate-400">
                        {selectedMethod === 'citation-augmented' && 'Advanced analysis with source verification and temporal context'}
                        {selectedMethod === 'hybrid' && 'Cross-validates multiple methods for highest accuracy'}
                        {selectedMethod === 'temporal-focus' && 'Specialized analysis for time-sensitive claims'}
                        {selectedMethod === 'source-priority' && 'Emphasizes source credibility in final assessment'}
                        {selectedMethod === 'google-ai' && 'Uses Google Fact Check Tools and search APIs'}
                        {selectedMethod === 'newsdata' && 'Focuses on recent news coverage verification'}
                        {selectedMethod === 'gemini-only' && 'Basic AI-only fact checking'}
                    </div>
                </div>
                <button
                    onClick={() => onAnalyze(selectedMethod)}
                    disabled={isLoading}
                    className="px-6 py-2.5 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
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