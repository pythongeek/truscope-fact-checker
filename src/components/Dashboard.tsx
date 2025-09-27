import React, { useState } from 'react';
import { FactCheckReport } from '@/types/factCheck';
import ColorCodedText from './ColorCodedText';
import AutoEditorTab from './AutoEditorTab';
import ComplianceDashboard from './compliance/ComplianceDashboard';

interface DashboardProps {
    result: FactCheckReport;
    isLoading?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ result, isLoading }) => {
    const [activeTab, setActiveTab] = useState('overview');

const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'category-analysis', name: 'Category Analysis', icon: '🏷️' },
    { id: 'original-text-analysis', name: 'Original Text Analysis', icon: '📄' },
    { id: 'evidence', name: 'Evidence', icon: '🔍' },
    { id: 'source-credibility', name: 'Source Analysis', icon: '📊' },
    { id: 'temporal-analysis', name: 'Temporal Analysis', icon: '⏰' },
    { id: 'breakdown', name: 'Breakdown', icon: '📈' },
    { id: 'methodology', name: 'Methodology', icon: '🔬' },
    { id: 'search-results', name: 'Search Results', icon: '🌐' },
    { id: 'compliance', name: 'IFCN Compliance', icon: '✅' }, // NEW
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

const renderCategoryAnalysis = () => {
    const categoryRating = result.category_rating;
    if (!categoryRating) {
        return (
            <div className="text-center py-12 text-slate-400">
                <div className="text-6xl mb-4">🏷️</div>
                <h3 className="text-xl font-semibold mb-2">Category Analysis Not Available</h3>
                <p>This analysis method does not provide categorical ratings.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className={`p-6 rounded-2xl border ${getScoreBackground(categoryRating.numericScore)}`}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-100">Category Rating</h3>
                        <p className="text-xl font-semibold capitalize text-slate-200">
                            {categoryRating.category.replace('-', ' ')}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className={`text-4xl font-bold ${getScoreColor(categoryRating.numericScore)}`}>
                            {categoryRating.confidence}%
                        </div>
                        <div className="text-slate-400 text-sm">Confidence</div>
                    </div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                    <h4 className="font-semibold text-slate-300 mb-2">Analysis Reasoning:</h4>
                    <p className="text-slate-300 leading-relaxed">{categoryRating.reasoning}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <div className="text-lg font-bold text-slate-200 capitalize">
                            {categoryRating.evidenceStrength}
                        </div>
                        <div className="text-sm text-slate-400">Evidence Strength</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-slate-200 capitalize">
                            {categoryRating.certaintyLevel}
                        </div>
                        <div className="text-sm text-slate-400">Certainty Level</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const renderSourceCredibilityAnalysis = () => {
    const sourceAnalysis = result.source_credibility_analysis;
    if (!sourceAnalysis) {
        return (
            <div className="text-center py-12 text-slate-400">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">Source Analysis Not Available</h3>
                <p>This analysis method does not include source credibility analysis.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-slate-100 mb-4">Source Credibility Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-slate-200">
                            {sourceAnalysis.analyses?.length || 0}
                        </div>
                        <div className="text-sm text-slate-400">Sources Analyzed</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                            {sourceAnalysis.averageCredibility || 0}
                        </div>
                        <div className="text-sm text-slate-400">Average Credibility</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                            {sourceAnalysis.highCredibilitySources || 0}
                        </div>
                        <div className="text-sm text-slate-400">High Credibility</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">
                            {sourceAnalysis.flaggedSources || 0}
                        </div>
                        <div className="text-sm text-slate-400">Flagged Sources</div>
                    </div>
                </div>
            </div>

            {sourceAnalysis.biasWarnings && sourceAnalysis.biasWarnings.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
                    <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Bias Warnings</h4>
                    <ul className="text-yellow-200 text-sm space-y-1">
                        {sourceAnalysis.biasWarnings.map((warning: string, index: number) => (
                            <li key={index}>• {warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            {sourceAnalysis.analyses && sourceAnalysis.analyses.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-200">Individual Source Analysis</h4>
                    {sourceAnalysis.analyses.map((analysis: any, index: number) => (
                        <div key={index} className="bg-slate-800/40 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <h5 className="font-medium text-slate-200">{analysis.domain}</h5>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    analysis.credibilityScore >= 80 ? 'bg-green-500/20 text-green-300' :
                                    analysis.credibilityScore >= 60 ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                    {analysis.credibilityScore}/100
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-400">Bias: </span>
                                    <span className="text-slate-300 capitalize">{analysis.biasRating}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400">Factual: </span>
                                    <span className="text-slate-300 capitalize">{analysis.factualReporting}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400">Type: </span>
                                    <span className="text-slate-300 capitalize">{analysis.category}</span>
                                </div>
                            </div>
                            {analysis.notes && (
                                <p className="text-xs text-slate-400 mt-2">{analysis.notes}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const renderTemporalAnalysis = () => {
    const temporalAnalysis = result.temporal_analysis;
    if (!temporalAnalysis || !temporalAnalysis.hasTemporalClaims) {
        return (
            <div className="text-center py-12 text-slate-400">
                <div className="text-6xl mb-4">⏰</div>
                <h3 className="text-xl font-semibold mb-2">No Temporal Claims Detected</h3>
                <p>This content does not contain time-based references that require verification.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-2xl">
                <h3 className="text-xl font-bold text-slate-100 mb-4">Temporal Analysis Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-slate-200">
                            {temporalAnalysis.validations?.length || 0}
                        </div>
                        <div className="text-sm text-slate-400">Temporal References</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                            {temporalAnalysis.overallTemporalScore || 0}%
                        </div>
                        <div className="text-sm text-slate-400">Temporal Accuracy</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">
                            {temporalAnalysis.temporalWarnings?.length || 0}
                        </div>
                        <div className="text-sm text-slate-400">Temporal Issues</div>
                    </div>
                </div>
            </div>

            {temporalAnalysis.temporalWarnings && temporalAnalysis.temporalWarnings.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                    <h4 className="font-semibold text-red-300 mb-2">⚠️ Temporal Issues</h4>
                    <ul className="text-red-200 text-sm space-y-1">
                        {temporalAnalysis.temporalWarnings.map((warning: string, index: number) => (
                            <li key={index}>• {warning}</li>
                        ))}
                    </ul>
                </div>
            )}

            {temporalAnalysis.validations && temporalAnalysis.validations.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-200">Individual Temporal Validations</h4>
                    {temporalAnalysis.validations.map((validation: any, index: number) => (
                        <div key={index} className={`p-4 rounded-lg border ${
                            validation.isValid ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                        }`}>
                            <div className="flex justify-between items-start mb-2">
                                <h5 className={`font-medium ${validation.isValid ? 'text-green-300' : 'text-red-300'}`}>
                                    {validation.isValid ? '✅ Valid' : '❌ Invalid'} Temporal Reference
                                </h5>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    validation.confidence >= 80 ? 'bg-green-500/20 text-green-300' :
                                    validation.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                    {validation.confidence}% confidence
                                </span>
                            </div>
                            <p className="text-slate-300 mb-2">{validation.context}</p>
                            <p className="text-xs text-slate-400">{validation.reasoning}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
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
case 'category-analysis':
    return renderCategoryAnalysis();
case 'source-credibility':
    return renderSourceCredibilityAnalysis();
case 'temporal-analysis':
    return renderTemporalAnalysis();
case 'compliance':
    return (
        <ComplianceDashboard
            factCheckReport={result}
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