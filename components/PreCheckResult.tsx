import React from 'react';
import type { FactCheckResult } from '../types/preCheck';
import LoadingSpinner from './LoadingSpinner';

interface PreCheckResultProps {
  result: FactCheckResult | null;
  isLoading: boolean;
}

const getVerdictColor = (verdict: FactCheckResult['verdict']) => {
  switch (verdict) {
    case 'True':
      return 'text-green-400';
    case 'False':
      return 'text-red-400';
    case 'Misleading':
      return 'text-yellow-400';
    default:
      return 'text-slate-400';
  }
};

const PreCheckResult: React.FC<PreCheckResultProps> = ({ result, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-3 mt-3 bg-slate-800/60 rounded-lg">
        <LoadingSpinner />
        <span className="ml-3 text-slate-400">Searching for existing fact-checks...</span>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  if (result.status === 'Not Found') {
    return (
      <div className="p-3 mt-3 bg-slate-800/60 rounded-lg text-center">
        <p className="text-slate-400">No existing fact-checks found for this claim.</p>
      </div>
    );
  }

  return (
    <div className="p-4 mt-3 bg-slate-800/60 rounded-lg border-l-4 border-blue-500">
      <h4 className="font-semibold text-blue-300 mb-2">Existing Fact-Check Found</h4>
      <p className="text-slate-300">
        <strong className="font-semibold">Original Claim:</strong> "{result.originalClaim}"
      </p>
      <p className="mt-1">
        <strong className="font-semibold">Verdict:</strong>{' '}
        <span className={`font-bold ${getVerdictColor(result.verdict)}`}>
          {result.verdict}
        </span>
      </p>
      <p className="mt-1">
        <strong className="font-semibold">Source:</strong> {result.source}
      </p>
      {result.url && (
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-blue-400 hover:text-blue-300 hover:underline transition-colors text-sm"
        >
          Read full article &rarr;
        </a>
      )}
    </div>
  );
};

export default PreCheckResult;
