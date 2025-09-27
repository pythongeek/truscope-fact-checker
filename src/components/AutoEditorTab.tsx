import React, { useState, useEffect } from 'react';
import { FactCheckReport } from '../types/factCheck';
import { EditorMode, EditorResult, FactCheckAnalysis } from '../types/advancedEditor';
import { AutoEditorIntegrationService } from '../services/autoEditorIntegration';

interface AutoEditorTabProps {
  result: FactCheckReport;
  originalText: string;
}

const AutoEditorTab: React.FC<AutoEditorTabProps> = ({ result, originalText }) => {
  const [analysis, setAnalysis] = useState<FactCheckAnalysis | null>(null);
  const [editorResult, setEditorResult] = useState<EditorResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<EditorMode>('enhanced');
  const [activeView, setActiveView] = useState<'analysis' | 'editor' | 'stats'>('analysis');
  const [apiStatus, setApiStatus] = useState<{ available: boolean; message: string; model: string } | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<string>('');
  const [tokenStats, setTokenStats] = useState<any[]>([]);

  const autoEditorService = AutoEditorIntegrationService.getInstance();

  // Check API health when component mounts
  useEffect(() => {
    checkAPIStatus();
    loadTokenStats();
  }, []);

  useEffect(() => {
    if (result && originalText) {
      generateAnalysisFromResult();
    }
  }, [result, originalText]);

  // Save selected model to storage when it changes
  useEffect(() => {
    try {
      const modelSelector = document.querySelector('[data-model-selector]') as HTMLSelectElement;
      if (modelSelector) {
        const handleModelChange = () => {
          sessionStorage.setItem('truescope-selected-model', modelSelector.value);
          checkAPIStatus(); // Recheck status with new model
        };

        modelSelector.addEventListener('change', handleModelChange);
        return () => modelSelector.removeEventListener('change', handleModelChange);
      }
    } catch (error) {
      console.warn('Could not bind to model selector:', error);
    }
  }, []);

  const checkAPIStatus = async () => {
    try {
      const status = await autoEditorService.checkAPIHealth();
      setApiStatus(status);
    } catch (error) {
      setApiStatus({
        available: false,
        message: 'Unable to check API status',
        model: 'unknown'
      });
    }
  };

  const loadTokenStats = () => {
    try {
      const stats = autoEditorService.getTokenUsageStats();
      setTokenStats(stats.slice(-20)); // Show last 20 entries
    } catch (error) {
      console.warn('Could not load token stats:', error);
      setTokenStats([]);
    }
  };

  const generateAnalysisFromResult = async () => {
    if (!result || !originalText) return;

    setIsAnalyzing(true);
    try {
      const analysis: FactCheckAnalysis = {
        segments: convertToColorCodedSegments(result),
        overallScore: result.final_score,
        verdict: result.final_verdict,
        timestamp: new Date().toISOString(),
        corrections: extractCorrections(result),
        originalReport: result
      };

      setAnalysis(analysis);
    } catch (error) {
      console.error('Failed to generate analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAutoCorrect = async () => {
    if (!analysis) return;

    setIsEditing(true);
    setCorrectionStatus('Initializing auto-correction...');

    try {
      // Check API status first
      setCorrectionStatus('Checking API availability...');
      const status = await autoEditorService.checkAPIHealth();

      if (!status.available) {
        setCorrectionStatus(`API unavailable (${status.model}) - using fallback method...`);
      } else {
        setCorrectionStatus(`Using ${status.model} for AI correction...`);
      }

      setCorrectionStatus('Processing corrections...');
      const result = await autoEditorService.performAutoCorrection(originalText, analysis, selectedMode);

      setEditorResult(result);
      setActiveView('editor');
      setCorrectionStatus('Correction completed successfully!');

      // Refresh token stats
      loadTokenStats();

    } catch (error: any) {
      console.error('Auto-correction failed:', error);
      setCorrectionStatus(`Error: ${error.message}`);

      // Show user-friendly error message
      if (error.message.includes('503')) {
        alert('🔧 API service is temporarily unavailable. We\'ve applied basic corrections using our fallback method. Please try again later for AI-powered corrections.');
      } else if (error.message.includes('404')) {
        alert('🔧 The selected AI model is not available. Please try selecting a different model or use the fallback correction method.');
      } else {
        alert(`Auto-correction failed: ${error.message}`);
      }
    } finally {
      setIsEditing(false);
      setTimeout(() => setCorrectionStatus(''), 5000); // Clear status after 5 seconds
    }
  };

  const convertToColorCodedSegments = (report: FactCheckReport) => {
    // Enhanced segment conversion with temporal validation
    if (report.originalTextSegments && report.originalTextSegments.length > 0) {
      return report.originalTextSegments.map((segment, index) => {
        // Check for temporal issues in this segment
        const hasTemporalIssues = checkTemporalIssues(segment.text);
        const adjustedScore = hasTemporalIssues ? Math.max(segment.score - 20, 0) : segment.score;

        return {
          text: segment.text,
          score: adjustedScore,
          color: scoreToColor(adjustedScore),
          startIndex: index * Math.floor(originalText.length / report.originalTextSegments!.length),
          endIndex: (index + 1) * Math.floor(originalText.length / report.originalTextSegments!.length),
          reason: hasTemporalIssues
            ? `${getReasonForScore(adjustedScore)} - Temporal inconsistency detected`
            : getReasonForScore(adjustedScore),
          temporalIssues: hasTemporalIssues
        };
      });
    }

    // Enhanced single segment analysis
    const hasTemporalIssues = checkTemporalIssues(originalText);
    const adjustedScore = hasTemporalIssues ? Math.max(report.final_score - 20, 0) : report.final_score;

    return [{
      text: originalText,
      score: adjustedScore,
      color: scoreToColor(adjustedScore),
      startIndex: 0,
      endIndex: originalText.length,
      reason: hasTemporalIssues
        ? `${getReasonForScore(adjustedScore)} - Temporal inconsistency detected`
        : getReasonForScore(adjustedScore),
      temporalIssues: hasTemporalIssues
    }];
  };

  // ADD this new helper method after convertToColorCodedSegments
  const checkTemporalIssues = (text: string): boolean => {
    const currentDate = new Date();
    const temporalPatterns = [
      /(\w+\s+\d{4})/g,           // "August 2025"
      /(\d{1,2}\/\d{1,2}\/\d{4})/g, // "8/15/2025"
      /(\d{4}-\d{1,2}-\d{1,2})/g,   // "2025-08-15"
      /(in \d{4})/g,              // "in 2025"
      /(since \d{4})/g,           // "since 2025"
    ];

    for (const pattern of temporalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          try {
            const extractedDate = new Date(match.replace(/in |since /, ''));
            if (!isNaN(extractedDate.getTime())) {
              const daysDiff = (currentDate.getTime() - extractedDate.getTime()) / (1000 * 3600 * 24);

              // FIXED LOGIC: Past dates should be valid, not flagged as issues
              if (daysDiff < -365) { // Only flag if more than 1 year in future
                return true;
              }
            }
          } catch (error) {
            // Date parsing failed, could indicate an issue
            continue;
          }
        }
      }
    }
    return false;
  };

  const scoreToColor = (score: number): 'green' | 'yellow' | 'orange' | 'red' => {
    if (score >= 75) return 'green';
    if (score >= 50) return 'yellow';
    if (score >= 25) return 'orange';
    return 'red';
  };

  const getReasonForScore = (score: number): string => {
    if (score >= 75) return 'Factually accurate and verified by reliable sources';
    if (score >= 50) return 'Moderately correct but may lack context or contain minor inaccuracies';
    if (score >= 25) return 'Partially correct with some inaccuracies or missing context';
    return 'Contains false, misleading, or manipulative information that requires correction';
  };

  const extractCorrections = (report: FactCheckReport) => {
    return report.evidence.filter(e => e.score < 75).map(evidence => ({
      original: 'Statement requiring verification',
      corrected: evidence.quote,
      reason: `According to ${evidence.publisher}`,
      confidence: evidence.score
    }));
  };

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      green: 'bg-green-100 border-green-400 text-green-800',
      yellow: 'bg-yellow-100 border-yellow-400 text-yellow-800',
      orange: 'bg-orange-100 border-orange-400 text-orange-800',
      red: 'bg-red-100 border-red-400 text-red-800'
    };
    return colorMap[color] || 'bg-gray-100 border-gray-400 text-gray-800';
  };

  const renderColorLegend = () => (
    <div className="bg-slate-800/30 p-4 rounded-xl mb-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-3">Color Legend</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span className="text-slate-300"><strong>Green:</strong> Correct/Verified (75-100)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
          <span className="text-slate-300"><strong>Yellow:</strong> Moderately Correct (50-74)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
          <span className="text-slate-300"><strong>Orange:</strong> Partially Correct (25-49)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span className="text-slate-300"><strong>Red:</strong> Wrong/Misleading (0-24)</span>
        </div>
      </div>
    </div>
  );

  const renderTokenStatsView = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-slate-100">Token Usage Statistics</h3>
          <div className="flex space-x-2">
            <button
              onClick={loadTokenStats}
              className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => {
                autoEditorService.clearTokenUsageStats();
                setTokenStats([]);
              }}
              className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {tokenStats.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📊</div>
            <p>No token usage data available yet.</p>
            <p className="text-sm">Statistics will appear after using auto-correction features.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-500/20 border border-blue-500/30 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-blue-300">
                  {tokenStats.reduce((sum, stat) => sum + stat.totalTokens, 0).toLocaleString()}
                </div>
                <div className="text-sm text-blue-400">Total Tokens Used</div>
              </div>
              <div className="bg-green-500/20 border border-green-500/30 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-300">{tokenStats.length}</div>
                <div className="text-sm text-green-400">Corrections Made</div>
              </div>
              <div className="bg-purple-500/20 border border-purple-500/30 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-300">
                  {Math.round(tokenStats.reduce((sum, stat) => sum + stat.totalTokens, 0) / tokenStats.length) || 0}
                </div>
                <div className="text-sm text-purple-400">Avg Tokens/Correction</div>
              </div>
              <div className="bg-orange-500/20 border border-orange-500/30 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-orange-300">
                  {[...new Set(tokenStats.map(stat => stat.model))].length}
                </div>
                <div className="text-sm text-orange-400">Models Used</div>
              </div>
            </div>

            {/* Recent Usage */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              <h4 className="font-semibold text-slate-200 mb-3">Recent Usage</h4>
              {tokenStats.slice().reverse().map((stat, index) => (
                <div key={index} className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-slate-200">{stat.model}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(stat.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-300">Input: {stat.inputTokens}</span>
                    <span className="text-blue-300">Output: {stat.outputTokens}</span>
                    <span className="text-purple-300">Total: {stat.totalTokens}</span>
                    <span className="text-orange-300">
                      Efficiency: {Math.round((stat.outputTokens / stat.inputTokens) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalysisView = () => {
    if (!analysis) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">Generating Analysis...</h3>
          <p className="text-slate-400">Please wait while we analyze your content for fact-checking.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {renderColorLegend()}

        <div className="bg-slate-800/50 p-6 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-100">Overall Analysis</h3>
              <p className="text-slate-300">{analysis.verdict}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-slate-100">{analysis.overallScore}/100</div>
              <div className="text-sm text-slate-400">Accuracy Score</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Detailed Segment Analysis</h3>
          {analysis.segments.map((segment, index) => (
            <div key={index} className={`p-4 rounded-xl border-l-4 ${getColorClass(segment.color)} bg-slate-800/30`}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-sm text-slate-200">
                  Segment {index + 1} - Score: {segment.score}/100
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                  segment.color === 'green' ? 'bg-green-500' :
                  segment.color === 'yellow' ? 'bg-yellow-500' :
                  segment.color === 'orange' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}>
                  {segment.color.toUpperCase()}
                </span>
              </div>
              <p className="mb-2 text-slate-100 leading-relaxed">{segment.text}</p>
              <p className="text-xs text-slate-400">{segment.reason}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Select Correction Mode</h3>

          {/* API Status Indicator */}
          {apiStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
              apiStatus.available
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-300'
            }`}>
              <div className="flex items-center">
                <span className="mr-2">{apiStatus.available ? '✅' : '⚠️'}</span>
                <span className="text-sm">
                  {apiStatus.available
                    ? `Ready with ${apiStatus.model}`
                    : `${apiStatus.model} unavailable - fallback mode available`}
                </span>
              </div>
              <button
                onClick={checkAPIStatus}
                className="text-xs px-2 py-1 bg-slate-500/30 rounded hover:bg-slate-500/50 transition-colors"
              >
                🔄 Check
              </button>
            </div>
          )}

          {/* Status Message */}
          {correctionStatus && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300">
              <div className="flex items-center">
                <div className="animate-spin w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full mr-2"></div>
                <span className="text-sm">{correctionStatus}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { id: 'quick-fix', name: 'Quick Fix', desc: 'Fast corrections for critical errors only', icon: '⚡', tokens: '~500' },
              { id: 'enhanced', name: 'Enhanced', desc: 'Comprehensive improvements with context', icon: '✨', tokens: '~1000' },
              { id: 'complete-rewrite', name: 'Complete Rewrite', desc: 'Full restructure for maximum impact', icon: '🔄', tokens: '~2000' }
            ].map((mode) => (
              <div
                key={mode.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedMode === (mode.id as EditorMode)
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500'
                }`}
                onClick={() => setSelectedMode(mode.id as EditorMode)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-xl mr-2">{mode.icon}</span>
                    <span className="font-medium">{mode.name}</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-slate-600/50 rounded text-slate-400">
                    {mode.tokens}
                  </span>
                </div>
                <p className="text-xs opacity-80">{mode.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleAutoCorrect}
              disabled={isEditing}
              className={`px-8 py-4 rounded-xl font-medium text-lg transition-all ${
                isEditing
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg'
              }`}
            >
              {isEditing ? (
                <span className="flex items-center">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                  Auto-Correcting...
                </span>
              ) : '🤖 Auto-Correct Content'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditorView = () => {
    if (!editorResult) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✏️</div>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">No Corrections Available</h3>
          <p className="text-slate-400">Please run the auto-correction process first.</p>
        </div>
      );
    }

    const isFallbackMode = editorResult.mode.includes('fallback');

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-500/20 border border-green-500/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-green-300">{editorResult.improvementScore}%</div>
            <div className="text-sm text-green-400">Improvement Score</div>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-blue-300">{editorResult.changesApplied.length}</div>
            <div className="text-sm text-blue-400">Changes Applied</div>
          </div>
          <div className="bg-purple-500/20 border border-purple-500/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-purple-300">{editorResult.confidence}%</div>
            <div className="text-sm text-purple-400">Confidence</div>
          </div>
          <div className="bg-orange-500/20 border border-orange-500/30 p-4 rounded-xl text-center">
            <div className="text-2xl font-bold text-orange-300">{Math.round(editorResult.processingTime / 1000)}s</div>
            <div className="text-sm text-orange-400">Processing Time</div>
          </div>
        </div>

        {isFallbackMode && (
          <div className="bg-yellow-500/20 border border-yellow-500/30 p-4 rounded-xl">
            <div className="flex items-center">
              <span className="text-yellow-300 mr-2">⚠️</span>
              <span className="text-yellow-300 font-medium">Fallback Mode Used</span>
            </div>
            <p className="text-yellow-200/80 text-sm mt-1">
              AI service was unavailable, so rule-based corrections were applied.
              Try again later for AI-powered improvements.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-slate-200 mb-3 flex items-center">
              <span className="w-3 h-3 bg-red-400 rounded-full mr-2"></span>
              Original Text
            </h4>
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl h-64 overflow-y-auto">
              <div className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed">
                {editorResult.originalText}
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-slate-200 mb-3 flex items-center">
              <span className="w-3 h-3 bg-green-400 rounded-full mr-2"></span>
              Corrected Text
              <button
                onClick={() => navigator.clipboard.writeText(editorResult.editedText)}
                className="ml-3 text-xs px-3 py-1 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
              >
                📋 Copy
              </button>
            </h4>
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl h-64 overflow-y-auto">
              <div className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed">
                {editorResult.editedText}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-xl">
          <h4 className="font-semibold text-slate-200 mb-4">Applied Changes & Corrections</h4>
          {editorResult.changesApplied.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <div className="text-4xl mb-2">✅</div>
              <p>No changes needed - your content was already accurate!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {editorResult.changesApplied.map((change, index) => (
                <div key={index} className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      change.type === 'modification' ? 'bg-yellow-500/20 text-yellow-300' :
                      change.type === 'addition' ? 'bg-green-500/20 text-green-300' :
                      change.type === 'deletion' ? 'bg-red-500/20 text-red-300' :
                      'bg-blue-500/20 text-blue-300'
                    }`}>
                      {change.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">
                      Confidence: {Math.round(change.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <div className="mb-1">
                      <strong className="text-red-300">Before:</strong>
                      <span className="ml-2 line-through text-red-300">{change.originalPhrase}</span>
                    </div>
                    {change.newPhrase && (
                      <div className="mb-2">
                        <strong className="text-green-300">After:</strong>
                        <span className="ml-2 text-green-300">{change.newPhrase}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 bg-slate-800/50 p-2 rounded">
                    <strong>Reason:</strong> {change.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/30 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            🤖 Auto Editor with Fact-Check Integration
          </h2>
          <p className="text-slate-300">
            Automatically correct and improve content based on comprehensive fact-checking analysis
          </p>
        </div>

        <div className="flex bg-slate-700/50 rounded-lg p-1">
          <button
            onClick={() => setActiveView('analysis')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'analysis'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            📊 Analysis
          </button>
          <button
            onClick={() => setActiveView('editor')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'editor'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            ✏️ Editor
          </button>
          <button
            onClick={() => setActiveView('stats')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'stats'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            📈 Stats
          </button>
        </div>
      </div>

      {activeView === 'analysis' && renderAnalysisView()}
      {activeView === 'editor' && renderEditorView()}
      {activeView === 'stats' && renderTokenStatsView()}
    </div>
  );
};

export default AutoEditorTab;