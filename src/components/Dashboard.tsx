import React, { useState } from 'react';
import { FactCheckReport } from '@/types/factCheck';
import ColorCodedText from './ColorCodedText';
import AutoEditorTab from './AutoEditorTab';

interface DashboardProps {
    result: FactCheckReport;
    isLoading?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ result, isLoading }) => {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', name: 'Overview', icon: '📊' },
        { id: 'original-text-analysis', name: 'Original Text Analysis', icon: '📄' },
        { id: 'evidence', name: 'Evidence', icon: '🔍' },
        { id: 'breakdown', name: 'Breakdown', icon: '📈' },
        { id: 'methodology', name: 'Methodology', icon: '🔬' },
        { id: 'search-results', name: 'Search Results', icon: '🌐' },
        { id: 'advanced-editor', name: 'Advanced Editor', icon: '🤖' }
    ];

    if (isLoading) {
        return (
            <div className="bg-slate-800/50 rounded-2xl p-8 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-300">Analyzing your content...</p>
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-green-400';
        if (score >= 50) return 'text-yellow-400';
        if (score >= 25) return 'text-orange-400';
        return 'text-red-400';
    };

    const getScoreBackground = (score: number) => {
        if (score >= 75) return 'bg-green-500/20 border-green-500/30';
        if (score >= 50) return 'bg-yellow-500/20 border-yellow-500/30';
        if (score >= 25) return 'bg-orange-500/20 border-orange-500/30';
        return 'bg-red-500/20 border-red-500/30';
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        <div className={`p-6 rounded-2xl border ${getScoreBackground(result.final_score)}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-100">Final Verdict</h3>
                                    <p className={`text-lg font-semibold ${getScoreColor(result.final_score)}`}>
                                        {result.final_verdict}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className={`text-4xl font-bold ${getScoreColor(result.final_score)}`}>
                                        {result.final_score}/100
                                    </div>
                                    <div className="text-slate-400 text-sm">Credibility Score</div>
                                </div>
                            </div>
                            {result.reasoning && (
                                <div className="bg-slate-900/50 p-4 rounded-lg">
                                    <h4 className="font-semibold text-slate-300 mb-2">Analysis Summary:</h4>
                                    <p className="text-slate-300 leading-relaxed">{result.reasoning}</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-800/50 p-6 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-blue-400">
                                    {result.evidence?.length || 0}
                                </div>
                                <div className="text-slate-400 text-sm">Sources Analyzed</div>
                            </div>
                            <div className="bg-slate-800/50 p-6 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-purple-400">
                                    {result.metadata?.sources_consulted?.high_credibility || 0}
                                </div>
                                <div className="text-slate-400 text-sm">High-Credibility Sources</div>
                            </div>
                            <div className="bg-slate-800/50 p-6 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-indigo-400">
                                    {result.metadata?.processing_time_ms ? Math.round(result.metadata.processing_time_ms / 1000) : 0}s
                                </div>
                                <div className="text-slate-400 text-sm">Analysis Time</div>
                            </div>
                        </div>
                    </div>
                );

            case 'original-text-analysis':
                return <ColorCodedText segments={result.originalTextSegments} />;

            case 'evidence':
                return (
                    <div className="space-y-4">
                        {result.evidence && result.evidence.length > 0 ? (
                            result.evidence.map((evidence, index) => (
                                <div key={index} className="bg-slate-800/50 p-6 rounded-2xl">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-100">{evidence.publisher}</h3>
                                            <p className="text-sm text-slate-400">
                                                Reliability: {evidence.score}/100
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            evidence.score >= 75 ? 'bg-green-500/20 text-green-300' :
                                            evidence.score >= 50 ? 'bg-yellow-500/20 text-yellow-300' :
                                            'bg-red-500/20 text-red-300'
                                        }`}>
                                            {evidence.type}
                                        </span>
                                    </div>
                                    <p className="text-slate-300 mb-3 italic">"{evidence.quote}"</p>
                                    {evidence.url && (
                                        <a
                                            href={evidence.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 text-sm"
                                        >
                                            View Source →
                                        </a>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-400">
                                <div className="text-6xl mb-4">🔍</div>
                                <h3 className="text-xl font-semibold mb-2">No Evidence Available</h3>
                                <p>No external sources were found or analyzed for this claim.</p>
                            </div>
                        )}
                    </div>
                );

            case 'breakdown':
                return (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-slate-100">Score Breakdown</h3>
                        {result.score_breakdown?.metrics?.map((metric, index) => (
                            <div key={index} className="bg-slate-800/50 p-6 rounded-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-slate-200">{metric.name}</h4>
                                    <span className={`text-lg font-bold ${getScoreColor(metric.score)}`}>
                                        {metric.score}/100
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm">{metric.description}</p>
                            </div>
                        ))}
                        {result.score_breakdown?.final_score_formula && (
                            <div className="bg-slate-900/50 p-4 rounded-lg">
                                <h4 className="font-semibold text-slate-300 mb-2">Calculation Method:</h4>
                                <p className="text-slate-400 text-sm">{result.score_breakdown.final_score_formula}</p>
                            </div>
                        )}
                    </div>
                );

            case 'methodology':
                return (
                    <div className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-2xl">
                            <h3 className="text-xl font-bold text-slate-100 mb-4">Analysis Methodology</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-semibold text-slate-200 mb-2">Method Used</h4>
                                    <p className="text-slate-300 capitalize">{result.metadata?.method_used}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-200 mb-2">APIs Consulted</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {result.metadata?.apis_used?.map((api, index) => (
                                            <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                                                {api}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {result.metadata?.warnings && result.metadata.warnings.length > 0 && (
                                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                    <h4 className="font-semibold text-yellow-300 mb-2">Warnings & Limitations:</h4>
                                    <ul className="text-yellow-200 text-sm space-y-1">
                                        {result.metadata.warnings.map((warning, index) => (
                                            <li key={index}>• {warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'search-results':
                return (
                    <div className="space-y-4">
                        {result.searchEvidence?.results && result.searchEvidence.results.length > 0 ? (
                            <>
                                <div className="bg-slate-800/50 p-4 rounded-xl mb-6">
                                    <h3 className="font-semibold text-slate-200 mb-2">Search Query Used:</h3>
                                    <p className="text-slate-300 bg-slate-900/50 px-3 py-2 rounded font-mono text-sm">
                                        "{result.searchEvidence.query}"
                                    </p>
                                </div>
                                {result.searchEvidence.results.map((searchResult, index) => (
                                    <div key={index} className="bg-slate-800/50 p-6 rounded-2xl">
                                        <h4 className="font-semibold text-slate-100 mb-2">
                                            {searchResult.title}
                                        </h4>
                                        <p className="text-slate-300 text-sm mb-3">
                                            {searchResult.snippet}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-400">
                                                Source: {searchResult.source}
                                            </span>
                                            <a
                                                href={searchResult.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-400 hover:text-blue-300 text-sm"
                                            >
                                                View Full Article →
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="text-center py-12 text-slate-400">
                                <div className="text-6xl mb-4">🌐</div>
                                <h3 className="text-xl font-semibold mb-2">No Search Results</h3>
                                <p>No external search results were found for this analysis.</p>
                            </div>
                        )}
                    </div>
                );

            case 'advanced-editor':
                return (
                    <AutoEditorTab
                        result={result}
                        originalText={result.originalText || ''}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <div className="bg-slate-800/30 rounded-2xl overflow-hidden">
            <div className="border-b border-slate-700">
                <nav className="flex flex-wrap -mb-px">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`mr-2 py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-600'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="p-6">
                {renderTabContent()}
            </div>
        </div>
    );
};

export default Dashboard;