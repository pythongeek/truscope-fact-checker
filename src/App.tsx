import React, { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InputSection, { AnalysisMethod } from './components/InputSection';
import HistoryView from './components/HistoryView';
import { runFactCheckOrchestrator, fetchNewsData } from './services/geminiService';
import { areAllKeysProvided } from './services/apiKeyService';
import { saveReportToHistory } from './services/historyService';
import { trackFactCheckUsage } from './utils/tracking';
import { AnalysisError } from './types';
import { FactCheckReport } from './types/factCheck';
import { LightBulbIcon, ExportIcon } from './components/icons';
import SettingsModal from './components/SettingsModal';
import { handleExport, ExportFormat } from './utils/export';


const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <svg className="animate-spin h-12 w-12 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h2 className="mt-4 text-xl font-semibold text-slate-200">Analyzing Content...</h2>
        <p className="text-slate-300 mt-1">Our AI is running a deep analysis. This may take a moment.</p>
    </div>
);

type AppView = 'checker' | 'history';

const App: React.FC = () => {
    const [inputText, setInputText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<AnalysisError | null>(null);
    const [analysisResult, setAnalysisResult] = useState<FactCheckReport | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [currentView, setCurrentView] = useState<AppView>('checker');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const handleAnalyze = useCallback(async (method: AnalysisMethod) => {
        if (!inputText.trim()) {
            setError({ message: 'Please enter some content to analyze.' });
            return;
        }

        if (!areAllKeysProvided()) {
            setError({ message: 'One or more API keys are missing. Please complete the configuration in the Settings panel.' });
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        const startTime = Date.now();

        try {
            let report: FactCheckReport;
            if (method === 'newsdata') {
                const newsArticles = await fetchNewsData(inputText);
                report = {
                    final_verdict: newsArticles.length > 0
                        ? `Found ${newsArticles.length} recent news article(s) related to the topic.`
                        : "No recent news articles found for the given topic.",
                    final_score: 50, // Neutral score
                    evidence: newsArticles.map((article, index) => ({
                        id: `news-${index}`,
                        publisher: article.source,
                        url: article.link,
                        quote: article.title,
                        score: 65,
                        type: 'news' as 'news',
                    })),
                    score_breakdown: {
                        final_score_formula: "Not applicable for News Coverage mode.",
                        metrics: [],
                        confidence_intervals: { lower_bound: 45, upper_bound: 55 }
                    },
                    metadata: {
                        method_used: "Recent News Coverage",
                        processing_time_ms: Date.now() - startTime,
                        apis_used: ["newsdata.io"],
                        sources_consulted: { total: newsArticles.length, high_credibility: 0, conflicting: 0 },
                        warnings: newsArticles.length === 0 ? ['No articles were identified.'] : [],
                    },
                    searchEvidence: undefined,
                };
            } else {
                report = await runFactCheckOrchestrator(inputText, method);
            }
            setAnalysisResult(report);
            saveReportToHistory(inputText, report);
            trackFactCheckUsage(report); // Track performance and usage metrics

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError({ message: err.message });
            } else {
                setError({ message: 'An unknown error occurred.' });
            }
        } finally {
            setIsLoading(false);
        }
    }, [inputText]);

    const handleSelectReport = (report: FactCheckReport, claimText: string) => {
        setAnalysisResult(report);
        setInputText(claimText);
        setCurrentView('checker');
        setError(null);
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const onExport = (format: ExportFormat) => {
        if (analysisResult) {
            handleExport(analysisResult, format);
        }
        setIsExportMenuOpen(false);
    };

    const renderMainContent = () => {
        if (currentView === 'history') {
            return <HistoryView onSelectReport={handleSelectReport} />;
        }
        return (
            <>
                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-100">Fact-Checker Dashboard</h2>
                        <p className="text-slate-300 mt-1">Analyze content to uncover insights and verify claims.</p>
                    </div>
                    {analysisResult && !isLoading && (
                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setIsExportMenuOpen(prev => !prev)}
                                className="flex items-center gap-2 px-4 py-2 font-semibold text-slate-200 bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-colors"
                                aria-haspopup="true"
                                aria-expanded={isExportMenuOpen}
                            >
                                <ExportIcon className="w-5 h-5" />
                                Export Analysis
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                                    <div className="p-2">
                                        <p className="px-2 py-1 text-xs font-semibold text-slate-300">Export Options</p>
                                        <button onClick={() => onExport('json-full')} className="w-full text-left px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700/80 rounded">Full Report (JSON)</button>
                                        <button onClick={() => onExport('json-summary')} className="w-full text-left px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700/80 rounded">Summary (JSON)</button>
                                        <button onClick={() => onExport('csv-evidence')} className="w-full text-left px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700/80 rounded">Evidence (CSV)</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </header>
                <InputSection
                    inputText={inputText}
                    onTextChange={setInputText}
                    onAnalyze={handleAnalyze}
                    isLoading={isLoading}
                />
                <div className="mt-6">
                    {isLoading && <LoadingSpinner />}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-lg text-center">
                            <h3 className="font-semibold">Analysis Failed</h3>
                            <p className="text-sm">{error.message}</p>
                        </div>
                    )}
                    {analysisResult && <Dashboard result={analysisResult} />}
                    {!isLoading && !analysisResult && !error && (
                        <div className="text-center py-10 bg-slate-800/30 rounded-2xl">
                             <LightBulbIcon className="w-12 h-12 mx-auto text-slate-500" />
                            <h3 className="mt-4 text-xl font-semibold text-slate-200">Ready for Analysis</h3>
                            <p className="mt-1 text-slate-300">Enter text above and click "Verify Claims" to begin.</p>
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="min-h-screen flex bg-slate-900">
            <Sidebar 
                onSettingsClick={() => setIsSettingsModalOpen(true)}
                currentView={currentView}
                onNavigate={setCurrentView} 
            />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {renderMainContent()}
                </div>
            </main>
            <SettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
            />
        </div>
    );
};

export default App;