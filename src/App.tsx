import React, { useState, useEffect } from 'react'; // Added useEffect
import Sidebar from './components/Sidebar';
import InputSection, { AnalysisMethod } from './components/InputSection';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import SettingsModal from './components/SettingsModal';
import TrendingMisinformation from './components/TrendingMisinformation';
import { FactCheckReport } from './types/factCheck';
import { runFactCheckOrchestrator } from './services/geminiService';
import { saveReportToHistory } from './services/historyService';
import { parseAIJsonResponse } from './utils/jsonParser'; // Added import

// Initialize the global JSON fix on app startup
function initializeGlobalJsonFix() {
  // Store the original JSON.parse method
  const originalJsonParse = JSON.parse;

  // Override JSON.parse globally to handle AI response parsing
  (JSON as any).parse = function(text: string, reviver?: (key: string, value: any) => any): any {
    try {
      // Try the original JSON.parse first
      return originalJsonParse.call(this, text, reviver);
    } catch (error) {
      // If original fails and the text looks like it might be an AI response
      if (typeof text === 'string' && (
        text.includes('```') ||
        text.includes('final_verdict') ||
        text.includes('score_breakdown') ||
        text.includes('enhanced_claim_text') ||
        text.trim().startsWith('```json') ||
        (text.includes('{') && text.includes('}') && text.includes('`'))
      )) {
        try {
          console.warn('[JSON Fix] Standard JSON.parse failed, attempting robust AI response parsing');
          const result = parseAIJsonResponse(text);
          console.log('[JSON Fix] Successfully parsed AI response');
          return result;
        } catch (robustError) {
          console.error('[JSON Fix] Robust parsing also failed:', robustError);
          console.error('[JSON Fix] Original text sample:', text.substring(0, 200));
          // If robust parsing also fails, throw the original error
          throw error;
        }
      }
      // For non-AI responses, throw the original error
      throw error;
    }
  };

  console.log('[JSON Fix] Global JSON parser override initialized for AI responses');
}


type View = 'checker' | 'history' | 'trending';

const App: React.FC = () => {
    // Add the useEffect hook to initialize the fix
    useEffect(() => {
        initializeGlobalJsonFix();
    }, []);

    const [currentView, setCurrentView] = useState<View>('checker');
    const [inputText, setInputText] = useState('');
    const [result, setResult] = useState<FactCheckReport | null>(null);
    const [currentClaimText, setCurrentClaimText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleAnalyze = async (method: AnalysisMethod) => {
        if (!inputText.trim()) {
            setError('Please enter some text to analyze.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            // Map the AnalysisMethod to the expected service method names
            const serviceMethod = method === 'newsdata' ? 'citation-augmented' : method;

            const report = await runFactCheckOrchestrator(
                inputText,
                serviceMethod as 'gemini-only' | 'google-ai' | 'hybrid' | 'citation-augmented'
            );

            setResult(report);
            setCurrentClaimText(inputText);
            saveReportToHistory(inputText, report);

            // Show success message for Citation-Augmented method
            if (method === 'citation-augmented' && report.evidence.length > 0) {
                console.log(`✅ Citation-Augmented Analysis completed with ${report.evidence.length} external sources verified.`);
            }

        } catch (err) {
            console.error('Analysis failed:', err);
            setError(err instanceof Error ? err.message : 'An unexpected error occurred during analysis.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectReport = (report: FactCheckReport, claimText: string) => {
        setResult(report);
        setCurrentClaimText(claimText);
        setCurrentView('checker');
    };

    const handleClearResults = () => {
        setResult(null);
        setCurrentClaimText('');
        setInputText('');
        setError(null);
    };

    const renderContent = () => {
        switch (currentView) {
            case 'checker':
                return (
                    <div className="max-w-6xl mx-auto space-y-8">
                        <header className="text-center">
                            <h1 className="text-4xl font-bold text-slate-100 mb-2">
                                Fact-Checker Dashboard
                            </h1>
                            <p className="text-slate-300 max-w-2xl mx-auto">
                                Analyze content to uncover insights and verify claims with our advanced
                                Citation-Augmented Analysis powered by external source verification.
                            </p>
                        </header>

                        <InputSection
                            inputText={inputText}
                            onTextChange={setInputText}
                            onAnalyze={handleAnalyze}
                            isLoading={isLoading}
                        />

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="font-semibold mb-1">Analysis Error</h4>
                                        <p className="text-sm">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {result && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-100">Analysis Results</h2>
                                        {currentClaimText && (
                                            <p className="text-slate-400 text-sm mt-1">
                                                Original claim: "{currentClaimText.length > 100 ? currentClaimText.slice(0, 100) + '...' : currentClaimText}"
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleClearResults}
                                        className="px-4 py-2 text-sm text-slate-300 bg-slate-700/50 rounded-lg hover:bg-slate-600/50 transition-colors"
                                    >
                                        Clear Results
                                    </button>
                                </div>
                                <Dashboard result={result} isLoading={isLoading} />
                            </div>
                        )}

                        {!result && !isLoading && !error && (
                            <div className="text-center py-16 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 className="text-xl font-semibold text-slate-300 mb-2">Ready to Analyze</h3>
                                <p className="max-w-md mx-auto">
                                    Enter a claim or statement above and select an analysis method to get started.
                                    The Citation-Augmented method is recommended for the most verifiable results.
                                </p>
                            </div>
                        )}
                    </div>
                );
            case 'history':
                return (
                    <div className="max-w-6xl mx-auto">
                        <HistoryView onSelectReport={handleSelectReport} />
                    </div>
                );
            case 'trending':
                return (
                    <div className="max-w-6xl mx-auto">
                        <TrendingMisinformation />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
            <div className="flex">
                <Sidebar
                    onSettingsClick={() => setIsSettingsOpen(true)}
                    currentView={currentView}
                    onNavigate={setCurrentView}
                />

                <main className="flex-1 p-6 overflow-hidden">
                    {renderContent()}
                </main>
            </div>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};

export default App;