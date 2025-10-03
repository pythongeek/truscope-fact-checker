import React from 'react';
import { FactCheckEvidence } from '../lib/fact-check-enhanced';

interface EnhancedFactCheckReportProps {
  evidence: FactCheckEvidence;
  processingTime: number;
}

const getVerdictColor = (verdict: string) => {
  switch (verdict.toLowerCase()) {
    case 'true':
      return 'text-green-400';
    case 'partially-true':
    case 'mostly true':
      return 'text-sky-400';
    case 'misleading':
    case 'mixed':
      return 'text-yellow-400';
    case 'false':
    case 'mostly false':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
};

export const EnhancedFactCheckReport: React.FC<EnhancedFactCheckReportProps> = ({ evidence, processingTime }) => {
  const highCredibilitySources = evidence.sources.filter(s => s.source.rating >= 80).length;

  return (
    <div className="space-y-6">
      {/* Main Verdict */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100">Final Verdict</h2>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-400">{evidence.confidence}/100</div>
            <div className={`text-sm font-semibold capitalize ${getVerdictColor(evidence.verdict)}`}>{evidence.verdict}</div>
          </div>
        </div>
        <p className="text-slate-300">{evidence.reasoning}</p>
      </div>

      {/* Source Credibility Report */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">Source Credibility Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-400">
              {evidence.aggregateCredibility}
            </div>
            <div className="text-sm text-slate-400">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {highCredibilitySources}
            </div>
            <div className="text-sm text-slate-400">High-Quality Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-400">
              {evidence.sources.length}
            </div>
            <div className="text-sm text-slate-400">Total Sources</div>
          </div>
        </div>
      </div>

      {/* Evidence Section */}
      {evidence.sources && evidence.sources.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Supporting Evidence</h3>
          <div className="space-y-3">
            {evidence.sources.map((source, idx) => (
              <div key={idx} className="border border-slate-700 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-300">{source.source.domain}</span>
                  <span className={`px-2 py-1 rounded text-xs capitalize ${
                      source.source.classification === 'highly-credible' ? 'bg-green-500/10 text-green-300' :
                      source.source.classification === 'credible' ? 'bg-sky-500/10 text-sky-300' :
                      source.source.classification === 'mixed' ? 'bg-yellow-500/10 text-yellow-300' :
                      'bg-red-500/10 text-red-300'
                    }`}>
                      {source.source.classification.replace('-', ' ')}
                    </span>
                </div>
                <p className="text-sm text-slate-400 mb-3">{source.snippet}</p>
                <div className="flex items-center justify-between">
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      View Source →
                    </a>
                  )}
                  <div className="text-xs text-slate-500" title={`Rating: ${source.source.rating}/100`}>
                    Credibility: {source.source.rating}/100
                  </div>
                </div>
                {source.source.warnings && source.source.warnings.length > 0 && (
                  <div className="mt-2 text-xs text-yellow-500/80">
                    Warning: {source.source.warnings.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-slate-900/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">Analysis Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm text-slate-400">Method</div>
            <div className="font-medium capitalize text-slate-300">
              Enhanced Orchestrator
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Processing Time</div>
            <div className="font-medium text-slate-300">{processingTime}ms</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Sources Consulted</div>
            <div className="font-medium text-slate-300">{evidence.sources.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};