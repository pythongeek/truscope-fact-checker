import React from 'react';
import { ClaimVerification, FactVerdict } from '../types';

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

  // Helper function to map status to verdict for color determination
  const getVerdictColor = (status: ClaimVerification['status']) => {
    // Map status values to color classes
    switch (status) {
      case 'Verified': return 'text-green-600';
      case 'Unverified': return 'text-yellow-600';
      case 'Disputed': return 'text-red-600';
      case 'Retracted': return 'text-orange-600';
      case 'Error': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  // Helper to display user-friendly status
  const getDisplayStatus = (status: ClaimVerification['status']): string => {
    return status;
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-md mb-4">
      <p className="font-semibold text-gray-800">
        Claim: "{claim.claim || claim.claimText}"
      </p>
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-center p-3 bg-slate-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-500">Verdict</p>
          <p className={`font-bold text-xl ${getVerdictColor(claim.status)}`}>
            {getDisplayStatus(claim.status)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Confidence</p>
          <p className="font-bold text-xl">
            {Math.round(claim.confidence || claim.confidenceScore)}%
          </p>
        </div>
      </div>

      {claim.explanation && (
        <div className="mt-4 prose prose-sm max-w-none">
          <p><strong>Explanation:</strong> {claim.explanation}</p>
        </div>
      )}

      {claim.reasoning && (
        <div className="mt-4 prose prose-sm max-w-none">
          <p><strong>Reasoning:</strong> {claim.reasoning}</p>
        </div>
      )}

      <div className="mt-4">
        <h4 className="font-semibold mb-2">
          Evidence ({claim.evidence?.length || 0} sources)
        </h4>
        <div className="space-y-3">
          {claim.evidence?.map((evidenceItem, index) => (
            <div 
              key={evidenceItem.id || index} 
              className="p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-center">
                <a 
                  href={evidenceItem.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 font-semibold hover:underline truncate pr-4"
                >
                  {evidenceItem.publisher}
                </a>
                <div className="flex space-x-3 text-xs">
                  {evidenceItem.credibilityScore !== undefined && (
                    <span className="font-medium">
                      Credibility: {Math.round(evidenceItem.credibilityScore)}%
                    </span>
                  )}
                  {evidenceItem.relevanceScore !== undefined && (
                    <span className="font-medium">
                      Relevance: {Math.round(evidenceItem.relevanceScore)}%
                    </span>
                  )}
                  {evidenceItem.relevance !== undefined && !evidenceItem.relevanceScore && (
                    <span className="font-medium">
                      Relevance: {Math.round(evidenceItem.relevance)}%
                    </span>
                  )}
                </div>
              </div>
              {evidenceItem.quote && (
                <p className="text-sm text-gray-700 mt-1 italic">
                  "{evidenceItem.quote}"
                </p>
              )}
              {!evidenceItem.quote && evidenceItem.snippet && (
                <p className="text-sm text-gray-700 mt-1">
                  {evidenceItem.snippet}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedClaimAnalysis;
