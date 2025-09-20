import React, { useState } from 'react';
import { SmartCorrection, DetectedIssue, CorrectionAnalysis } from '../types/corrections';

interface CorrectionsDisplayProps {
  corrections: SmartCorrection[];
  analysis: CorrectionAnalysis;
  onApplyCorrection: (correctionId: string, selectedPhrasing?: string) => void;
}

const getSeverityColor = (severity: DetectedIssue['severity']) => {
  switch (severity) {
    case 'critical': return 'bg-red-500/20 border-red-500/30 text-red-300';
    case 'high': return 'bg-orange-500/20 border-orange-500/30 text-orange-300';
    case 'medium': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300';
    case 'low': return 'bg-blue-500/20 border-blue-500/30 text-blue-300';
  }
};

const CorrectionsDisplay: React.FC<CorrectionsDisplayProps> = ({
  corrections,
  analysis,
  onApplyCorrection
}) => {
  const [expandedCorrections, setExpandedCorrections] = useState<Set<string>>(new Set());

  const toggleExpanded = (correctionId: string) => {
    const newExpanded = new Set(expandedCorrections);
    if (newExpanded.has(correctionId)) {
      newExpanded.delete(correctionId);
    } else {
      newExpanded.add(correctionId);
    }
    setExpandedCorrections(newExpanded);
  };

  if (corrections.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
        <h3 className="text-lg font-semibold text-green-300">No Issues Found</h3>
        <p className="text-green-400 mt-1">Your content appears to be factually accurate!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analysis Summary */}
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-100 mb-3">Correction Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-100">{analysis.totalIssues}</div>
            <div className="text-xs text-slate-400">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-100">{analysis.overallAccuracy}%</div>
            <div className="text-xs text-slate-400">Accuracy Score</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold ${
              analysis.issuesBySeverity.critical > 0 ? 'text-red-400' :
              analysis.issuesBySeverity.high > 0 ? 'text-orange-400' :
              analysis.issuesBySeverity.medium > 0 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {analysis.issuesBySeverity.critical > 0 ? 'Critical' :
               analysis.issuesBySeverity.high > 0 ? 'High' :
               analysis.issuesBySeverity.medium > 0 ? 'Medium' : 'Low'}
            </div>
            <div className="text-xs text-slate-400">Max Severity</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-indigo-400 capitalize">
              {analysis.recommendedAction.replace('_', ' ')}
            </div>
            <div className="text-xs text-slate-400">Recommended</div>
          </div>
        </div>
      </div>

      {/* Individual Corrections */}
      <div className="space-y-4">
        {corrections.map((correction) => (
          <CorrectionCard
            key={correction.id}
            correction={correction}
            expanded={expandedCorrections.has(correction.id)}
            onToggle={() => toggleExpanded(correction.id)}
            onApply={onApplyCorrection}
          />
        ))}
      </div>
    </div>
  );
};

const CorrectionCard: React.FC<{
  correction: SmartCorrection;
  expanded: boolean;
  onToggle: () => void;
  onApply: (correctionId: string, selectedPhrasing?: string) => void;
}> = ({ correction, expanded, onToggle, onApply }) => {
  const [selectedPhrasing, setSelectedPhrasing] = useState<string>(correction.correctedStatement);

  const highestSeverity = correction.specificIssues.reduce((max, issue) => {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityOrder[issue.severity] > severityOrder[max] ? issue.severity : max;
  }, 'low' as DetectedIssue['severity']);

  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(highestSeverity)}`}>
                {highestSeverity.toUpperCase()}
              </span>
              <span className="text-sm text-slate-300">
                Confidence: {correction.confidence}%
              </span>
            </div>
            <div className="mb-2">
              <span className="text-sm font-medium text-slate-300">Original: </span>
              <span className="text-slate-200 bg-red-500/20 px-2 py-1 rounded">
                "{correction.originalStatement}"
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-slate-300">Suggested: </span>
              <span className="text-slate-200 bg-green-500/20 px-2 py-1 rounded">
                "{correction.correctedStatement}"
              </span>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-slate-400 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* Detailed Issue Information */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Issues Identified:</h4>
            <div className="space-y-2">
              {correction.specificIssues.map((issue, index) => (
                <div key={index} className={`p-3 rounded border ${getSeverityColor(issue.severity)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm capitalize">
                      {issue.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs">
                      {issue.confidence}% confident
                    </span>
                  </div>
                  <p className="text-sm">{issue.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Correct Information */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Correct Information:</h4>
            <div className="bg-slate-900/50 p-3 rounded border border-green-500/30">
              <p className="text-slate-200">{correction.correctInformation}</p>
            </div>
          </div>

          {/* Alternative Phrasings */}
          {correction.alternativePhrasings.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Choose Your Preferred Phrasing:</h4>
              <div className="space-y-2">
                {[correction.correctedStatement, ...correction.alternativePhrasings].map((phrasing, index) => (
                  <label key={index} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name={`phrasing-${correction.id}`}
                      value={phrasing}
                      checked={selectedPhrasing === phrasing}
                      onChange={(e) => setSelectedPhrasing(e.target.value)}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-200 flex-1">"{phrasing}"</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Why This Correction is Needed:</h4>
            <div className="bg-slate-900/50 p-3 rounded border border-slate-600">
              <p className="text-slate-300 text-sm">{correction.correctionReasoning}</p>
            </div>
          </div>

          {/* Supporting Sources */}
          {correction.supportingSources.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Supporting Sources:</h4>
              <div className="space-y-2">
                {correction.supportingSources.map((source, index) => (
                  <div key={index} className="bg-slate-900/50 p-3 rounded border border-slate-600">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-200">{source.publisher}</span>
                      <span className="text-xs text-slate-400">
                        Reliability: {source.sourceCredibility}/100
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">"{source.quote}"</p>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:underline mt-1 inline-block"
                      >
                        View Source →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 border-t border-slate-700">
            <button
              onClick={() => onApply(correction.id, selectedPhrasing)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              Apply This Correction
            </button>
            <button
              onClick={onToggle}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectionsDisplay;
