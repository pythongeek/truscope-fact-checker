import React, { useState, useCallback } from 'react';
import { FactCheckMethod, UserCategory, FactCheckReport } from '../types/factCheck';
import { EnhancedFactCheckService } from '../services/enhancedFactCheckService';
import { saveReportToHistory } from '../services/historyService';
import { MethodSelector } from './MethodSelector';
import { EnhancedFactCheckReport } from './EnhancedFactCheckReport';
import { getMethodCapabilities } from '../services/methodCapabilities';

interface FactCheckInterfaceProps {
  initialReport?: FactCheckReport | null;
  initialClaimText?: string;
}

export const FactCheckInterface: React.FC<FactCheckInterfaceProps> = ({ initialReport = null, initialClaimText = '' }) => {
  const [selectedMethod, setSelectedMethod] = useState<FactCheckMethod>('comprehensive');
  const [userCategory, setUserCategory] = useState<UserCategory>('general');
  const [inputText, setInputText] = useState(initialClaimText);
  const [report, setReport] = useState<FactCheckReport | null>(initialReport);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setReport(initialReport);
    setInputText(initialClaimText);
  }, [initialReport, initialClaimText]);

  const factCheckService = new EnhancedFactCheckService();

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setReport(null);

    try {
      const result = await factCheckService.orchestrateFactCheck(inputText, selectedMethod);
      setReport(result);
      saveReportToHistory(inputText, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, selectedMethod, factCheckService]);

  const selectedCapability = getMethodCapabilities(selectedMethod);

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-10">
      {/* Header */}
      <div className="text-center border-b border-slate-700/50 pb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-3">
          Professional Fact-Checking Tool
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl mx-auto">
          Leveraging advanced AI for in-depth verification, source credibility analysis, and temporal consistency checking.
        </p>
      </div>

      {/* Method Selection */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/80 p-8 shadow-2xl shadow-black/30">
        <MethodSelector
          selectedMethod={selectedMethod}
          onMethodChange={setSelectedMethod}
          userCategory={userCategory}
          onUserCategoryChange={setUserCategory}
        />
      </div>

      {/* Text Input */}
      <div className="bg-slate-800/40 rounded-xl border border-slate-700/80 p-8 shadow-2xl shadow-black/30">
        <label className="block text-lg font-semibold text-slate-200 mb-4">
          Text to Fact-Check
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full p-4 bg-slate-900/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y text-lg"
          rows={6}
          placeholder="Enter the claim or statement you want to fact-check..."
        />

        {/* Analysis Button */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-slate-500">
            {selectedCapability.requiresInternet && (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>
                Requires internet connection
              </span>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !inputText.trim()}
            className={`px-8 py-3 rounded-lg font-semibold text-base transition-all duration-300 shadow-lg hover:shadow-indigo-500/40 ${
              isAnalyzing || !inputText.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:-translate-y-1'
            }`}
          >
            {isAnalyzing ? (
              <div className="flex items-center">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Analyzing...
              </div>
            ) : (
              `Run ${selectedCapability.name}`
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <p className="ml-3 text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {report && (
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Analysis Results</h2>
          <EnhancedFactCheckReport report={report} />
        </div>
      )}

      {/* Processing Indicator */}
      {isAnalyzing && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 text-center">
          <div className="animate-spin w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-blue-300 mb-2">
            Running {selectedCapability.name}
          </h3>
          <p className="text-blue-400">
            {selectedCapability.processingTime === 'fast' && 'This should take just a few seconds...'}
            {selectedCapability.processingTime === 'medium' && 'This may take up to a minute...'}
            {selectedCapability.processingTime === 'slow' && 'This may take several minutes for thorough analysis...'}
          </p>
        </div>
      )}
    </div>
  );
};