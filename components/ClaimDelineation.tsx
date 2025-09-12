import React, { useState } from 'react';
import type { Claim } from '../types/claim';
import type { AtomicStatement } from '../types/granularity';
import { granulateStatements } from '../services/statementGranulator';
import LoadingSpinner from './LoadingSpinner';
import GranulatedAnalysis from './GranulatedAnalysis';

interface ClaimDelineationProps {
  claims: Claim[] | null;
  isLoading: boolean;
}

interface GranularityState {
  isLoading: boolean;
  error: string | null;
  result: AtomicStatement[] | null;
}

const ClaimDelineation: React.FC<ClaimDelineationProps> = ({ claims, isLoading }) => {
  const [granularityData, setGranularityData] = useState<Record<number, GranularityState>>({});

  const handleGranulateClick = async (claimText: string, index: number) => {
    setGranularityData(prev => ({
      ...prev,
      [index]: { isLoading: true, error: null, result: null }
    }));

    try {
      const result = await granulateStatements(claimText);
      setGranularityData(prev => ({
        ...prev,
        [index]: { isLoading: false, error: null, result: result.atomicStatements }
      }));
    } catch (err) {
      setGranularityData(prev => ({
        ...prev,
        [index]: { isLoading: false, error: err instanceof Error ? err.message : 'An unknown error occurred.', result: null }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner />
        <span className="ml-4 text-slate-400">Extracting claims...</span>
      </div>
    );
  }

  if (!claims) {
    return null;
  }

  if (claims.length === 0) {
    return <p className="text-center text-slate-400 mt-8">No claims were identified in the text.</p>;
  }

  return (
    <div className="mt-8 bg-slate-800/50 rounded-xl p-6 border border-slate-700 shadow-lg animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-slate-100">Claim Delineation</h2>
      <div className="space-y-4">
        {claims.map((claim, index) => {
          const granularityState = granularityData[index];
          return (
            <div key={index} className="p-4 rounded-lg bg-slate-900/70 border border-slate-700 transition-shadow hover:shadow-md">
              <p className="text-slate-200">{claim.text}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  claim.isVerifiable
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                    : 'bg-amber-600/20 text-amber-300 border border-amber-500/50'
                }`}>
                  {claim.isVerifiable ? 'Verifiable Claim' : 'Opinion/General Assertion'}
                </span>
                {claim.isVerifiable && (
                  <button
                    onClick={() => handleGranulateClick(claim.text, index)}
                    disabled={granularityState?.isLoading}
                    className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {granularityState?.isLoading ? 'Analyzing...' : 'Analyze Statement'}
                  </button>
                )}
              </div>
              {granularityState && (
                <div className="mt-4">
                  {granularityState.error && (
                    <div className="text-red-400 bg-red-900/50 p-3 rounded-lg">{granularityState.error}</div>
                  )}
                  <GranulatedAnalysis
                    atomicStatements={granularityState.result}
                    isLoading={granularityState.isLoading}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClaimDelineation;
