import React from 'react';
import type { Claim } from '../types/claim';
import LoadingSpinner from './LoadingSpinner';

interface ClaimDelineationProps {
  claims: Claim[] | null;
  isLoading: boolean;
}

const ClaimDelineation: React.FC<ClaimDelineationProps> = ({ claims, isLoading }) => {
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
        {claims.map((claim, index) => (
          <div key={index} className="p-4 rounded-lg bg-slate-900/70 border border-slate-700 transition-shadow hover:shadow-md">
            <p className="text-slate-200">{claim.text}</p>
            <div className="mt-2">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                claim.isVerifiable
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                  : 'bg-amber-600/20 text-amber-300 border border-amber-500/50'
              }`}>
                {claim.isVerifiable ? 'Verifiable Claim' : 'Opinion/General Assertion'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClaimDelineation;
