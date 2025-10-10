// src/components/EnhancedFactCheckReport.tsx

import React from 'react';
import { TieredFactCheckResult } from '../types/factCheck';
// Import icons for each search type (e.g., from lucide-react)
import { Globe, Newspaper, CheckCircle } from 'lucide-react';

interface Props {
  report: TieredFactCheckResult;
}

const EnhancedFactCheckReport: React.FC<Props> = ({ report }) => {
  if (!report) return null;

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      {/* 1. Overall Score & Summary */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold">Overall Authenticity Score</h2>
        <p className="text-4xl font-bold text-blue-600">{report.overallAuthenticityScore}/100</p>
        <p className="mt-2 text-gray-600">{report.summary}</p>
      </div>

      {/* 2. Evidence Search Summary */}
      <div className="mb-6 p-4 border rounded-md">
        <h3 className="font-semibold mb-2">Evidence Gathering Process</h3>
        <div className="flex justify-around">
          <span className="flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-500" /> Google Fact Checks: {report.searchPhases.googleFactChecks.count} found</span>
          <span className="flex items-center"><Globe className="mr-2 h-5 w-5 text-blue-500" /> Web Search: {report.searchPhases.webSearches.count} found</span>
          <span className="flex items-center"><Newspaper className="mr-2 h-5 w-5 text-orange-500" /> News Search: {report.searchPhases.newsSearches.count} found</span>
        </div>
      </div>

      {/* 3. Claim-by-Claim Verification */}
      <div>
        <h3 className="font-semibold mb-3">Claim-by-Claim Analysis</h3>
        <div className="space-y-4">
          {report.claimVerifications.map((claim) => (
            <div key={claim.id} className="p-3 border rounded-md bg-white">
              <p className="font-semibold">Claim: "{claim.claimText}"</p>
              <p><strong>Verdict:</strong> {claim.status} (Confidence: {Math.round(claim.confidenceScore * 100)}%)</p>
              <p className="text-sm text-gray-700">{claim.explanation}</p>
              {/* Optionally, render the evidence list here */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedFactCheckReport;