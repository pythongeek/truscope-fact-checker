import React, { useState, useCallback, useEffect } from 'react';
import { FactCheckReport } from '../types/factCheck'; // Keep for history service compatibility
import { EnhancedFactCheckOrchestrator } from '../services/EnhancedFactCheckOrchestrator';
import { saveReportToHistory } from '../services/historyService';
import { EnhancedFactCheckReport } from './EnhancedFactCheckReport';
import { getMethodCapabilities } from '../services/methodCapabilities';
import { FactCheckEvidence } from '../lib/fact-check-enhanced';
import { useFactCheck } from '../hooks/useFactCheck';

// This adapter is now only used for saving to the history service, which expects the old format.
const convertEvidenceToLegacyReport = (evidence: FactCheckEvidence, originalText: string, processingTime: number): FactCheckReport => {
  const evidenceItems = evidence.sources.map((source, index) => ({
    id: `evidence-${index}`,
    publisher: source.source.domain,
    url: source.url,
    quote: source.snippet,
    score: source.source.rating,
    type: 'search_result' as 'search_result',
    source: source.source,
  }));

  return {
    id: `report-${Date.now()}`,
    originalText: originalText,
    final_verdict: evidence.verdict,
    final_score: evidence.confidence,
    reasoning: evidence.reasoning,
    evidence: evidenceItems,
    enhanced_claim_text: evidence.claim,
    score_breakdown: {
      final_score_formula: "Aggregated from new orchestrator",
      metrics: [],
    },
    metadata: {
      method_used: 'enhanced-orchestrator',
      processing_time_ms: processingTime,
      apis_used: ['gemini', 'serp-api', 'webz-io'],
      sources_consulted: {
        total: evidence.sources.length,
        high_credibility: evidence.sources.filter(s => s.source.rating >= 80).length,
        conflicting: 0,
      },
      warnings: [],
    },
    source_credibility_report: {
      overallScore: evidence.aggregateCredibility,
      highCredibilitySources: evidence.sources.filter(s => s.source.rating >= 80).length,
      flaggedSources: 0,
      biasWarnings: [],
      credibilityBreakdown: { academic: 0, news: evidence.sources.length, government: 0, social: 0 },
    },
    temporal_verification: {
      hasTemporalClaims: false,
      validations: [],
      overallTemporalScore: 0,
      temporalWarnings: [],
    },
  };
};

interface FactCheckInterfaceProps {
  initialClaimText?: string;
}

export const FactCheckInterface: React.FC<FactCheckInterfaceProps> = ({ initialClaimText = '' }) => {
  const [inputText, setInputText] = useState(initialClaimText);
  const { evidence, loading, error, performCheck } = useFactCheck();
  const [processingTime, setProcessingTime] = useState(0);

  useEffect(() => {
    setInputText(initialClaimText);
  }, [initialClaimText]);

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim()) {
      return;
    }
    const startTime = Date.now();
    await performCheck(inputText);
    const endTime = Date.now();
    setProcessingTime(endTime - startTime);
  }, [inputText, performCheck]);

  // Save to history when evidence is updated
  useEffect(() => {
    if (evidence) {
      const legacyReport = convertEvidenceToLegacyReport(evidence, inputText, processingTime);
      saveReportToHistory(inputText, legacyReport);
    }
  }, [evidence, inputText, processingTime]);

  const selectedCapability = getMethodCapabilities('comprehensive');

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
            disabled={loading || !inputText.trim()}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              loading || !inputText.trim()
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Analyzing...
              </div>
            ) : (
              `Run Analysis`
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

      {evidence && !loading && (
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Analysis Results</h2>
          <EnhancedFactCheckReport evidence={evidence} processingTime={processingTime} />
        </div>
      )}
    </div>
  );
};
