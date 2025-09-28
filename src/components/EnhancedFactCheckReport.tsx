import React from 'react';
import { FactCheckReport } from '../types/factCheck';

interface EnhancedFactCheckReportProps {
  report: FactCheckReport;
}

export const EnhancedFactCheckReport: React.FC<EnhancedFactCheckReportProps> = ({ report }) => {
  const Card: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
    <div className={`bg-slate-800/40 rounded-xl border border-slate-700/80 p-6 shadow-lg shadow-black/20 ${className}`}>
      {children}
    </div>
  );

  const SectionTitle: React.FC<{children: React.ReactNode}> = ({ children }) => (
    <h3 className="text-xl font-semibold mb-4 text-slate-200 border-b border-slate-700 pb-3">
      {children}
    </h3>
  );

  const StatBox: React.FC<{label: string, value: string | number, colorClass: string}> = ({ label, value, colorClass }) => (
    <div className="text-center bg-slate-900/50 p-4 rounded-lg">
      <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Main Verdict */}
      <Card>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Final Verdict</h2>
            <p className="text-lg text-slate-300">{report.final_verdict}</p>
            {report.reasoning && (
              <div className="mt-4 p-4 bg-slate-900/70 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400">{report.reasoning}</p>
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{report.final_score}</div>
            <div className="text-lg text-slate-400">Credibility Score</div>
            {report.category_rating && (
              <div className="mt-2 px-3 py-1 inline-block bg-indigo-500/10 text-indigo-300 rounded-full text-sm font-medium">{report.category_rating.category}</div>
            )}
          </div>
        </div>
      </Card>

      {/* Source Credibility Report */}
      <Card>
        <SectionTitle>Source Credibility Analysis</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatBox label="Overall Score" value={report.source_credibility_report.overallScore} colorClass="text-indigo-400" />
          <StatBox label="High-Quality Sources" value={report.source_credibility_report.highCredibilitySources} colorClass="text-green-400" />
          <StatBox label="Flagged Sources" value={report.source_credibility_report.flaggedSources} colorClass="text-red-400" />
          <StatBox label="Bias Warnings" value={report.source_credibility_report.biasWarnings.length} colorClass="text-orange-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-slate-300 mb-2">Source Categories:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.source_credibility_report.credibilityBreakdown).map(([type, count]) => (
                <span key={type} className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm capitalize">{type}: {count}</span>
              ))}
            </div>
          </div>
          {report.source_credibility_report.biasWarnings.length > 0 && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="font-semibold text-yellow-300 mb-2">Bias Warnings:</h4>
              <ul className="space-y-1 list-disc list-inside">
                {report.source_credibility_report.biasWarnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-400">{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* Temporal Verification */}
      {report.temporal_verification.hasTemporalClaims && (
        <Card>
          <SectionTitle>Temporal Verification</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatBox label="Temporal Accuracy" value={`${report.temporal_verification.overallTemporalScore.toFixed(0)}%`} colorClass="text-purple-400" />
            <StatBox label="Time References" value={report.temporal_verification.validations.length} colorClass="text-sky-400" />
            {report.temporal_verification.timelineAnalysis && (
              <StatBox label="Timeline Consistency" value={`${report.temporal_verification.timelineAnalysis.consistency.toFixed(0)}%`} colorClass="text-teal-400" />
            )}
          </div>
          {report.temporal_verification.temporalWarnings.length > 0 && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <h4 className="font-semibold text-orange-300 mb-2">Temporal Issues:</h4>
              <ul className="space-y-1 list-disc list-inside">
                {report.temporal_verification.temporalWarnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-orange-400">{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Evidence Section */}
      {report.evidence && report.evidence.length > 0 && (
        <Card>
          <SectionTitle>Supporting Evidence</SectionTitle>
          <div className="space-y-4">
            {report.evidence.map((evidence, idx) => (
              <div key={idx} className="border border-slate-700/80 rounded-lg p-4 bg-slate-900/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-300">{evidence.publisher}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    evidence.score >= 80 ? 'bg-green-500/10 text-green-300' :
                    evidence.score >= 60 ? 'bg-yellow-500/10 text-yellow-300' :
                    'bg-red-500/10 text-red-300'
                  }`}>
                    Score: {evidence.score}/100
                  </span>
                </div>
                <blockquote className="text-slate-400 border-l-4 border-slate-600 pl-4 italic my-2">
                  {evidence.quote}
                </blockquote>
                {evidence.url && (
                  <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    View Source →
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* User Category Recommendations */}
      {report.user_category_recommendations && report.user_category_recommendations.length > 0 && (
        <Card>
          <SectionTitle>Suitability for Different Users</SectionTitle>
          <div className="space-y-4">
            {report.user_category_recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/80">
                <div>
                  <div className="font-semibold capitalize text-slate-200">{rec.category.replace('-', ' ')}</div>
                  <div className="text-sm text-slate-400">{rec.reasoning}</div>
                </div>
                <div className="text-right pl-4">
                  <div className="text-2xl font-bold text-indigo-400">{rec.suitabilityScore}</div>
                  <div className="text-xs text-slate-500">Suitability</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};