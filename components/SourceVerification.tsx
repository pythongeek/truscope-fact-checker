import React from 'react';
import type { SearchResult, ScoredEvidence } from '../types/verification';
import LoadingSpinner from './LoadingSpinner';

interface SourceVerificationProps {
  result: SearchResult | null;
  isLoading: boolean;
  progress: number;
  status: string;
}

const getVerdictColor = (isVerified: boolean, confidence: number) => {
  if (confidence < 50) return 'text-yellow-400';
  return isVerified ? 'text-green-400' : 'text-red-400';
};

const getCredibilityColor = (score: number) => {
  if (score > 80) return 'border-green-500';
  if (score > 60) return 'border-yellow-500';
  return 'border-red-500';
};

const SourceVerification: React.FC<SourceVerificationProps> = ({ result, isLoading, progress, status }) => {
  if (isLoading) {
    return (
      <div className="p-4 mt-4 bg-slate-800/60 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-300">Verifying with sources...</h4>
          <span className="text-sm font-bold text-blue-400">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-center text-sm text-slate-400 mt-2">{status}</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="p-4 mt-4 bg-slate-800/60 rounded-lg border-l-4 border-blue-500">
      <h4 className="font-semibold text-blue-300 mb-2">Source Verification Report</h4>
      <div className="flex items-baseline space-x-2">
        <p className={`text-lg font-bold ${getVerdictColor(result.isVerified, result.confidenceScore)}`}>
          {result.isVerified ? 'Verified' : 'Unverified'}
        </p>
        <span className="text-sm text-slate-400">(Confidence: {result.confidenceScore.toFixed(0)}%)</span>
      </div>
      <p className="text-slate-300 mt-1">{result.summary}</p>

      <h5 className="font-semibold text-slate-300 mt-4 mb-2">Evidence Considered:</h5>
      <div className="space-y-3">
        {result.evidence.filter(e => e.isRelevant).map((item, index) => (
          <div key={index} className={`p-3 rounded-lg bg-slate-900/50 border-l-4 ${getCredibilityColor(item.credibilityScore)}`}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-400 hover:underline">
              {item.title}
            </a>
            <p className="text-xs text-slate-500">{item.url}</p>
            <p className="text-sm text-slate-400 mt-1">"{item.snippet}"</p>
            <p className="text-right text-xs font-semibold text-slate-400 mt-1">
              Credibility: {item.credibilityScore.toFixed(0)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourceVerification;
