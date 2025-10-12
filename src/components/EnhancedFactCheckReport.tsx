// src/components/EnhancedFactCheckReport.tsx
import React from 'react';
import { TieredFactCheckResult } from '@/types';
import EnhancedClaimAnalysis from './EnhancedClaimAnalysis';

interface EnhancedFactCheckReportProps {
  report: TieredFactCheckResult;
}

export const EnhancedFactCheckReport: React.FC<EnhancedFactCheckReportProps> = ({ report }) => {
  if (!report) {
    return null; // Or a loading/placeholder component
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md mt-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
        Enhanced Fact-Check Report
      </h2>

      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-700">Overall Summary</h3>
        <p className="text-gray-600 mt-1">{report.summary}</p>
        <div className="mt-3 text-lg font-bold">
          Overall Authenticity Score:
          <span className="ml-2 text-blue-600">{report.overallAuthenticityScore.toFixed(0)}%</span>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3 text-gray-700">Detailed Claim Analysis</h3>
        <div className="space-y-4">
          {report.claimVerifications && report.claimVerifications.length > 0 ? (
            report.claimVerifications.map((claim) => (
              <EnhancedClaimAnalysis key={claim.id} claim={claim} />
            ))
          ) : (
            <p className="text-gray-500">No specific claims were analyzed.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedFactCheckReport;
