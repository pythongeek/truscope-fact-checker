import React, { useState } from 'react';
import { FactCheckReport } from '../types/factCheck';
import { rewriteContent, ContentRewrite } from '../services/textAnalysisService';

interface AutoEditorProps {
    originalText: string;
    factCheckReport: FactCheckReport;
    isOpen: boolean;
    onClose: () => void;
}

const AutoEditor: React.FC<AutoEditorProps> = ({
    originalText,
    factCheckReport,
    isOpen,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState<'editor' | 'comparison'>('editor');
    const [userPrompt, setUserPrompt] = useState('');
    const [isRewriting, setIsRewriting] = useState(false);
    const [rewriteResult, setRewriteResult] = useState<ContentRewrite | null>(null);
    const [editedContent, setEditedContent] = useState('');

    const handleRewrite = async () => {
        setIsRewriting(true);
        try {
            const result = await rewriteContent(
                originalText,
                factCheckReport,
                factCheckReport.originalTextSegments || [],
                userPrompt || undefined
            );
            setRewriteResult(result);
            setEditedContent(result.rewrittenText);
        } catch (error) {
            console.error('Rewrite failed:', error);
            alert('Failed to rewrite content. Please try again.');
        } finally {
            setIsRewriting(false);
        }
    };

    const handleCopyContent = () => {
        navigator.clipboard.writeText(editedContent);
        alert('Content copied to clipboard!');
    };

    const handleExportContent = () => {
        const blob = new Blob([editedContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_content_${new Date().toISOString().slice(0, 19)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] m-4 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-100">AI Content Editor</h2>
                        <p className="text-slate-300 text-sm">Improve content accuracy based on fact-check results</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab('editor')}
                        className={`px-6 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'editor'
                                ? 'text-indigo-400 border-b-2 border-indigo-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        AI Editor
                    </button>
                    <button
                        onClick={() => setActiveTab('comparison')}
                        className={`px-6 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'comparison'
                                ? 'text-indigo-400 border-b-2 border-indigo-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Before & After
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6">
                    {activeTab === 'editor' && (
                        <div className="h-full flex flex-col space-y-4">
                            {/* Custom Prompt Section */}
                            <div className="bg-slate-700/50 p-4 rounded-lg">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Custom Editing Instructions (Optional)
                                </label>
                                <textarea
                                    value={userPrompt}
                                    onChange={(e) => setUserPrompt(e.target.value)}
                                    placeholder="Example: 'Make the tone more professional and add more context to statistical claims.' Leave empty to use AI's default editing approach."
                                    className="w-full h-20 p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleRewrite}
                                    disabled={isRewriting}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {isRewriting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Rewriting Content...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Generate Improved Version
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Results Section */}
                            {rewriteResult && (
                                <div className="flex-1 flex flex-col space-y-4 min-h-0">
                                    {/* Stats */}
                                    <div className="bg-slate-700/50 p-4 rounded-lg">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold text-slate-100">Improvement Analysis</h3>
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                                rewriteResult.improvementScore >= 70 ? 'bg-green-500/20 text-green-300' :
                                                rewriteResult.improvementScore >= 40 ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-red-500/20 text-red-300'
                                            }`}>
                                                {rewriteResult.improvementScore}/100 Improvement
                                            </span>
                                        </div>
                                        <p className="text-slate-300 text-sm">{rewriteResult.changesExplanation}</p>
                                    </div>

                                    {/* Edited Content */}
                                    <div className="flex-1 min-h-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-slate-100">Improved Content</h3>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleCopyContent}
                                                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm rounded-md transition-colors"
                                                >
                                                    Copy
                                                </button>
                                                <button
                                                    onClick={handleExportContent}
                                                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm rounded-md transition-colors"
                                                >
                                                    Export
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            className="w-full h-full min-h-[300px] p-4 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'comparison' && rewriteResult && (
                        <div className="h-full flex flex-col space-y-4">
                            {/* Changes Summary */}
                            <div className="bg-slate-700/50 p-4 rounded-lg">
                                <h3 className="font-semibold text-slate-100 mb-3">Changes Applied</h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {rewriteResult.editsApplied.map((edit, index) => (
                                        <div key={index} className="flex items-start gap-3 p-2 bg-slate-800/50 rounded">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                                edit.type === 'removal' ? 'bg-red-500/20 text-red-300' :
                                                edit.type === 'modification' ? 'bg-yellow-500/20 text-yellow-300' :
                                                edit.type === 'addition' ? 'bg-green-500/20 text-green-300' :
                                                'bg-blue-500/20 text-blue-300'
                                            }`}>
                                                {edit.type.replace('-', ' ')}
                                            </span>
                                            <div className="flex-1 text-sm">
                                                <p className="text-slate-200 font-medium">"{edit.originalPhrase}"</p>
                                                {edit.newPhrase && (
                                                    <p className="text-slate-300 mt-1">→ "{edit.newPhrase}"</p>
                                                )}
                                                <p className="text-slate-400 text-xs mt-1">{edit.reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Side-by-side comparison */}
                            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                                <div>
                                    <h4 className="font-semibold text-slate-100 mb-2">Original</h4>
                                    <div className="h-full bg-slate-900/50 border border-slate-600 rounded-lg p-4 overflow-y-auto">
                                        <p className="text-slate-300 whitespace-pre-wrap">{originalText}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-100 mb-2">Improved Version</h4>
                                    <div className="h-full bg-slate-900/50 border border-slate-600 rounded-lg p-4 overflow-y-auto">
                                        <p className="text-slate-300 whitespace-pre-wrap">{rewriteResult.rewrittenText}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutoEditor;
