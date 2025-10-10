import React from 'react';
import { ClaimVerificationResult } from '../types';

interface EnhancedClaimAnalysisProps {
  claim: ClaimVerificationResult;
}

const EnhancedClaimAnalysis: React.FC<EnhancedClaimAnalysisProps> = ({ claim }) => {
  if (!claim) {
    return (
      <div className="bg-slate-800/50 p-6 rounded-lg text-center">
        <h3 className="text-lg font-semibold text-slate-300">No analysis available.</h3>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-md mb-4">
      <p className="font-semibold text-gray-800">Claim: "{claim.claimText}"</p>

      {/* Data-Driven Verdict Section */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-500">Verdict</p>
          <p className="font-bold text-xl">{claim.status}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Confidence</p>
          <p className="font-bold text-xl">{Math.round(claim.confidenceScore * 100)}%</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Source Balance</p>
          <div className="flex justify-center items-center space-x-3 text-lg">
            <span title="Supporting Sources">✅ {claim.reasoning.supportingSources}</span>
            <span title="Conflicting Sources">❌ {claim.reasoning.conflictingSources}</span>
          </div>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="mt-4 prose prose-sm max-w-none">
        <p><strong>Explanation:</strong> {claim.explanation}</p>
        <p className="text-gray-600"><strong>Reasoning:</strong> {claim.reasoning.conclusion}</p>
      </div>

      {/* Enhanced Evidence Display */}
      <div className="mt-4">
        <h4 className="font-semibold mb-2">Evidence ({claim.evidence.length} sources)</h4>
        <div className="space-y-3">
          {claim.evidence.map((evidenceItem, index) => (
            <div key={index} className="p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-center">
                    <a href={evidenceItem.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">
                      {evidenceItem.publisher}
                    </a>
                    <div className="flex space-x-3 text-xs">
                        <span className="font-medium">Credibility: {evidenceItem.credibilityScore}%</span>
                        <span className="font-medium">Relevance: {evidenceItem.relevanceScore}%</span>
                    </div>
                </div>
              <p className="text-sm text-gray-700 mt-1 italic">"{evidenceItem.snippet}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedClaimAnalysis;
