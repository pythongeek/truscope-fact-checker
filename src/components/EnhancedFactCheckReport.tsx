import React from 'react';
import { FactCheckReport } from '../types/factCheck';

interface EnhancedFactCheckReportProps {
  report: FactCheckReport;
}

export const EnhancedFactCheckReport: React.FC<EnhancedFactCheckReportProps> = ({ report }) => {
  return (
    <div className="space-y-6">
      {/* Main Verdict */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100">Final Verdict</h2>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-400">{report.final_score}/100</div>
            {report.category_rating && (
              <div className="text-sm text-slate-400">{report.category_rating.category}</div>
            )}
          </div>
        </div>
        <p className="text-slate-300">{report.final_verdict}</p>
        {report.reasoning && (
          <div className="mt-4 p-3 bg-slate-900/70 rounded">
            <p className="text-sm text-slate-400">{report.reasoning}</p>
          </div>
        )}
      </div>

      {/* Source Credibility Report */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">Source Credibility Analysis</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-400">
              {report.source_credibility_report.overallScore}
            </div>
            <div className="text-sm text-slate-400">Overall Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {report.source_credibility_report.highCredibilitySources}
            </div>
            <div className="text-sm text-slate-400">High-Quality Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {report.source_credibility_report.flaggedSources}
            </div>
            <div className="text-sm text-slate-400">Flagged Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              {report.source_credibility_report.biasWarnings.length}
            </div>
            <div className="text-sm text-slate-400">Bias Warnings</div>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="space-y-2">
          <h4 className="font-medium text-slate-300">Source Categories:</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(report.source_credibility_report.credibilityBreakdown).map(([type, count]) => (
              <span
                key={type}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm capitalize"
              >
                {type}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Bias Warnings */}
        {report.source_credibility_report.biasWarnings.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <h4 className="font-medium text-yellow-300 mb-2">Bias Warnings:</h4>
            <ul className="space-y-1">
              {report.source_credibility_report.biasWarnings.map((warning, idx) => (
                <li key={idx} className="text-sm text-yellow-400">• {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Temporal Verification */}
      {report.temporal_verification.hasTemporalClaims && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Temporal Verification</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {report.temporal_verification.overallTemporalScore.toFixed(0)}%
              </div>
              <div className="text-sm text-slate-400">Temporal Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-sky-400">
                {report.temporal_verification.validations.length}
              </div>
              <div className="text-sm text-slate-400">Time References</div>
            </div>
          </div>

          {/* Temporal Warnings */}
          {report.temporal_verification.temporalWarnings.length > 0 && (
            <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded">
              <h4 className="font-medium text-orange-300 mb-2">Temporal Issues:</h4>
              <ul className="space-y-1">
                {report.temporal_verification.temporalWarnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-orange-400">• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline Analysis */}
          {report.temporal_verification.timelineAnalysis && (
            <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded">
              <h4 className="font-medium text-purple-300 mb-2">Timeline Consistency:</h4>
              <div className="text-sm text-purple-400">
                Consistency Score: {report.temporal_verification.timelineAnalysis.consistency.toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Media Verification */}
      {report.media_verification_report && report.media_verification_report.hasVisualContent && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Media Verification</h3>

          {report.media_verification_report.reverseImageResults.map((result, idx) => (
            <div key={idx} className="p-3 bg-slate-900/70 rounded mb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">
                  Image {idx + 1}: {result.matchFound ? 'Match Found' : 'No Match'}
                </span>
                {result.matchFound && (
                  <span className="text-xs text-sky-400">
                    First seen: {result.firstAppearance}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Category Recommendations */}
      {report.user_category_recommendations && report.user_category_recommendations.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Suitability for Different Users</h3>

          <div className="space-y-3">
            {report.user_category_recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/70 rounded">
                <div>
                  <div className="font-medium capitalize text-slate-200">{rec.category.replace('-', ' ')}</div>
                  <div className="text-sm text-slate-400">{rec.reasoning}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-indigo-400">{rec.suitabilityScore}</div>
                  <div className="text-xs text-slate-500">Suitability</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Section */}
      {report.evidence && report.evidence.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-200">Supporting Evidence</h3>

          <div className="space-y-3">
            {report.evidence.map((evidence, idx) => (
              <div key={idx} className="border border-slate-700 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-300">{evidence.publisher}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    evidence.score >= 80 ? 'bg-green-500/10 text-green-300' :
                    evidence.score >= 60 ? 'bg-yellow-500/10 text-yellow-300' :
                    'bg-red-500/10 text-red-300'
                  }`}>
                    {evidence.score}/100
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-2">{evidence.quote}</p>
                {evidence.url && (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    View Source →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-slate-900/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-200">Analysis Details</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-slate-400">Method</div>
            <div className="font-medium capitalize text-slate-300">
              {report.metadata.method_used.replace('-', ' ')}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Processing Time</div>
            <div className="font-medium text-slate-300">{report.metadata.processing_time_ms}ms</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">Sources Consulted</div>
            <div className="font-medium text-slate-300">{report.metadata.sources_consulted.total}</div>
          </div>
          <div>
            <div className="text-sm text-slate-400">APIs Used</div>
            <div className="font-medium text-slate-300">{report.metadata.apis_used.length}</div>
          </div>
        </div>

        {/* Warnings */}
        {report.metadata.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <h4 className="font-medium text-yellow-300 mb-2">Warnings & Limitations:</h4>
            <ul className="space-y-1">
              {report.metadata.warnings.map((warning, idx) => (
                <li key={idx} className="text-sm text-yellow-400">• {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};