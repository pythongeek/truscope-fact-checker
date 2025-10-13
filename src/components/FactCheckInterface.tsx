import React, { useState, useCallback } from 'react';
import { FactCheckReport, PublishingContext, FactCheckMethod } from '@/types';
import { EnhancedFactCheckService } from '../services/EnhancedFactCheckService';
import { saveReportToHistory } from '../services/historyService';
import { logger } from '../utils/logger';
import { EnhancedFactCheckReport } from './EnhancedFactCheckReport';
import { getMethodCapabilities } from '../services/methodCapabilities';
import { TieredProgressIndicator, TierProgress } from './TieredProgressIndicator';
import { TieredFactCheckService } from '../services/tieredFactCheckService';

interface FactCheckInterfaceProps {
  initialReport?: FactCheckReport | null;
  initialClaimText?: string;
}

export const FactCheckInterface: React.FC<FactCheckInterfaceProps> = ({ initialReport = null, initialClaimText = '' }) => {
  const [inputText, setInputText] = useState(initialClaimText);
  const [report, setReport] = useState<FactCheckReport | null>(initialReport);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tieredProgress, setTieredProgress] = useState<TierProgress[]>([]);
  const [currentPhase, setCurrentPhase] = useState(0);

  const selectedMethod: FactCheckMethod = 'TEMPORAL';

  React.useEffect(() => {
    setReport(initialReport);
    setInputText(initialClaimText);
  }, [initialReport, initialClaimText]);

  const factCheckService = new EnhancedFactCheckService();

  const handleTieredFactCheck = async (text: string, context: PublishingContext) => {
    const initialProgress: TierProgress[] = [
      { tier: 'direct-verification', status: 'pending' },
      { tier: 'web-search', status: 'pending' },
      { tier: 'specialized-analysis', status: 'pending' },
      { tier: 'synthesis', status: 'pending' }
    ];

    setTieredProgress(initialProgress);
    setCurrentPhase(1);

    try {
      const tieredService = TieredFactCheckService.getInstance();
      const result = await tieredService.performTieredCheck(text, context);

      setReport(result);
      // Ensure result is not null before saving to history
      if (result) {
        // FIXED: Corrected the arguments passed to saveReportToHistory
        saveReportToHistory(result, selectedMethod, text);
      }
    } catch (error) {
      logger.error('Error running fact check from interface', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setReport(null);
    setTieredProgress([]);

    const context: PublishingContext = 'NewsArticle';
    await handleTieredFactCheck(inputText, context);
  }, [inputText]);

  const selectedCapability = getMethodCapabilities(selectedMethod);

  return (
    <div className="max-w-6xl mx-auto p-2 md:p-6 space-y-6 md:space-y-8 bg-slate-900 text-white">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
          Professional Fact-Checking Tool
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Advanced AI-powered verification with source credibility analysis
        </p>
      </div>

      {/* Text Input */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 md:p-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Text to Fact-Check:
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full p-4 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
          rows={6}
          placeholder="Enter the claim or statement you want to fact-check..."
        />

        {/* Analysis Button */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-400">
            {selectedCapability.requiresInternet && (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                Requires internet connection
              </span>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !inputText.trim()}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isAnalyzing || !inputText.trim()
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
      {isAnalyzing && tieredProgress.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <TieredProgressIndicator
            progress={tieredProgress}
            currentPhase={currentPhase}
          />
        </div>
      )}

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
