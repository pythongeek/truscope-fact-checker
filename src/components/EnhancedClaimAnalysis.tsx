import React from 'react';
import { ClaimVerification } from '../types'; // CORRECTED: Was ClaimVerificationResult

interface EnhancedClaimAnalysisProps {
  claim: ClaimVerification;
}

const EnhancedClaimAnalysis: React.FC<EnhancedClaimAnalysisProps> = ({ claim }) => {
  if (!claim) {
    return (
      <div className="bg-slate-100 p-6 rounded-lg text-center">
        <h3 className="text-lg font-semibold text-gray-700">No analysis available.</h3>
      </div>
    );
  }

  // Helper to determine the color based on the verdict
  const getVerdictColor = (status: ClaimVerification['status']) => {
    switch (status) {
      case 'TRUE':
        return 'text-green-600';
      case 'FALSE':
        return 'text-red-600';
      case 'MISLEADING':
        return 'text-orange-600';
      case 'MIXED':
        return 'text-yellow-600';
      case 'UNVERIFIED':
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-md mb-4">
      <p className="font-semibold text-gray-800">Claim: "{claim.claim}"</p>

      {/* Data-Driven Verdict Section */}
      <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-center p-3 bg-slate-50 rounded-lg`}>
        <div>
          <p className="text-sm font-medium text-gray-500">Verdict</p>
          <p className={`font-bold text-xl ${getVerdictColor(claim.status)}`}>{claim.status}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Confidence</p>
          <p className="font-bold text-xl">{Math.round(claim.confidence)}%</p>
        </div>
      </div>

      {/* AI Explanation */}
      {claim.explanation && (
        <div className="mt-4 prose prose-sm max-w-none">
          <p><strong>Explanation:</strong> {claim.explanation}</p>
        </div>
      )}

      {/* Enhanced Evidence Display */}
      <div className="mt-4">
        <h4 className="font-semibold mb-2">Evidence ({claim.evidence.length} sources)</h4>
        <div className="space-y-3">
          {claim.evidence.map((evidenceItem, index) => (
            <div key={index} className="p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-center">
                <a href={evidenceItem.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline truncate pr-4">
                  {evidenceItem.publisher}
                </a>
                <div className="flex space-x-3 text-xs">
                  <span className="font-medium">Score: {evidenceItem.score}%</span>
                  {evidenceItem.relevance && <span className="font-medium">Relevance: {evidenceItem.relevance}%</span>}
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-1 italic">"{evidenceItem.quote}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedClaimAnalysis;
