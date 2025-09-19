import React, { useState, useEffect } from 'react';
import { FactCheckReport } from '../types/factCheck';
import ReportView from './ReportView';
import AutoEditor from './AutoEditor';
import EnhancedColorCodedText from './EnhancedColorCodedText';
import { analyzeTextSegments } from '../services/textAnalysisService';
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from './icons';

interface EnhancedDashboardProps {
    result: FactCheckReport;
    originalText: string;
}

type Tab = 'Evidence' | 'Breakdown' | 'Methodology' | 'Search Results' | 'Original Text Analysis';

const VerdictDisplay: React.FC<{ verdict: string; score: number }> = ({ verdict, score }) => {
    const getVerdictStyle = (s: number) => {
        if (s > 75) {
            return {
                Icon: CheckCircleIcon,
                textColor: 'text-green-300',
                borderColor: 'border-green-500/30',
                bgColor: 'bg-green-500/10',
            };
        }
        if (s >= 40) {
            return {
                Icon: ExclamationCircleIcon,
                textColor: 'text-yellow-300',
                borderColor: 'border-yellow-500/30',
                bgColor: 'bg-yellow-500/10',
            };
        }
        return {
            Icon: XCircleIcon,
            textColor: 'text-red-300',
            borderColor: 'border-red-500/30',
            bgColor: 'bg-red-500/10',
        };
    };

    const { Icon, textColor, borderColor, bgColor } = getVerdictStyle(score);

    return (
        <div className={`flex-grow p-4 rounded-xl flex items-center gap-4 border ${borderColor} ${bgColor}`}>
            <Icon className={`w-10 h-10 flex-shrink-0 ${textColor}`} />
            <div>
                <h3 className="text-sm font-semibold text-slate-300">Final Verdict</h3>
                <p className={`text-xl font-bold ${textColor}`}>{verdict}</p>
            </div>
        </div>
    );
};

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const radius = 27;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s > 75) return 'stroke-green-400';
        if (s > 50) return 'stroke-yellow-400';
        return 'stroke-red-400';
    };

    const getTextColor = (s: number) => {
        if (s > 75) return 'text-green-400';
        if (s > 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 60 60">
                <circle className="text-slate-700" strokeWidth="6" stroke="currentColor" fill="transparent" r={radius} cx="30" cy="30" />
                <circle
                    className={`${getColor(score)} transition-all duration-1000 ease-out`}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="30"
                    cy="30"
                    transform="rotate(-90 30 30)"
                />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${getTextColor(score)}`}>
                {score}
            </div>
        </div>
    );
};

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({ result, originalText }) => {
    const [activeTab, setActiveTab] = useState<Tab>(() => {
        // Default to Original Text Analysis if available, otherwise Evidence
        return result.originalTextSegments && result.originalTextSegments.length > 0
            ? 'Original Text Analysis'
            : 'Evidence';
    });

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [enhancedResult, setEnhancedResult] = useState<FactCheckReport>(result);

    // Ensure text segments are available for all methods
    useEffect(() => {
        const ensureTextSegments = async () => {
            if (!result.originalTextSegments || result.originalTextSegments.length === 0) {
                setIsAnalyzing(true);
                try {
                    console.log('Generating text segments for better analysis...');
                    const segmentAnalysis = await analyzeTextSegments(originalText, result, result.metadata.method_used);

                    const updatedResult = {
                        ...result,
                        originalTextSegments: segmentAnalysis.segments
                    };

                    setEnhancedResult(updatedResult);

                    // Auto-switch to text analysis tab if segments were generated successfully
                    if (segmentAnalysis.segments.length > 0 && activeTab === 'Evidence') {
                        setActiveTab('Original Text Analysis');
                    }
                } catch (error) {
                    console.error('Failed to generate text segments:', error);
                } finally {
                    setIsAnalyzing(false);
                }
            }
        };

        ensureTextSegments();
    }, [result, originalText, activeTab]);

    // Show Original Text Analysis tab only if segments are available
    const availableTabs: Tab[] = enhancedResult.originalTextSegments && enhancedResult.originalTextSegments.length > 0
        ? ['Original Text Analysis', 'Evidence', 'Breakdown', 'Methodology', 'Search Results']
        : ['Evidence', 'Breakdown', 'Methodology', 'Search Results'];

    const renderTabContent = () => {
        if (activeTab === 'Original Text Analysis') {
            if (isAnalyzing) {
                return (
                    <div className="bg-slate-800/50 p-8 rounded-2xl text-center">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <svg className="animate-spin h-6 w-6 text-indigo-400" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-slate-300 font-medium">Analyzing text segments...</span>
                        </div>
                        <p className="text-slate-400 text-sm">
                            We're breaking down your text into analyzable segments for better fact-checking insights.
                        </p>
                    </div>
                );
            }

            return (
                <EnhancedColorCodedText
                    segments={enhancedResult.originalTextSegments}
                    originalText={originalText}
                    onOpenEditor={() => setIsEditorOpen(true)}
                />
            );
        }

        return <ReportView report={enhancedResult} activeTab={activeTab} />;
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-slate-800/50 p-6 rounded-2xl flex items-center gap-6">
                <ScoreCircle score={enhancedResult.final_score} />
                <VerdictDisplay verdict={enhancedResult.final_verdict} score={enhancedResult.final_score} />

                {/* Quick Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setIsEditorOpen(true)}
                        disabled={!enhancedResult.originalTextSegments || enhancedResult.originalTextSegments.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Auto Editor
                    </button>

                    {enhancedResult.originalTextSegments && enhancedResult.originalTextSegments.length > 0 && (
                        <div className="text-xs text-center">
                            <span className="text-green-400 font-semibold">
                                {enhancedResult.originalTextSegments.filter(s => s.score >= 75).length}
                            </span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-yellow-400 font-semibold">
                                {enhancedResult.originalTextSegments.filter(s => s.score >= 40 && s.score < 75).length}
                            </span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-red-400 font-semibold">
                                {enhancedResult.originalTextSegments.filter(s => s.score < 40).length}
                            </span>
                            <div className="text-slate-500 text-xs">High / Med / Low</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Enhanced Tab Navigation */}
            <nav className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-lg overflow-x-auto">
                {availableTabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            activeTab === tab
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                        aria-current={activeTab === tab ? 'page' : undefined}
                    >
                        {tab === 'Original Text Analysis' && (
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Text Analysis
                                {enhancedResult.originalTextSegments && enhancedResult.originalTextSegments.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-xs rounded-full">
                                        {enhancedResult.originalTextSegments.length}
                                    </span>
                                )}
                            </span>
                        )}
                        {tab !== 'Original Text Analysis' && tab}
                    </button>
                ))}
            </nav>

            {/* Tab Content */}
            <div className="min-h-[200px]">
                {renderTabContent()}
            </div>

            {/* Auto Editor Modal */}
            <AutoEditor
                originalText={originalText}
                factCheckReport={enhancedResult}
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
            />
        </div>
    );
};

export default EnhancedDashboard;
