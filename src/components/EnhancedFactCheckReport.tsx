// src/components/EnhancedFactCheckReport.tsx
import React from 'react';
import { TieredFactCheckResult } from '@/types';
import EnhancedClaimAnalysis from './EnhancedClaimAnalysis';

interface EnhancedFactCheckReportProps {
  report: TieredFactCheckResult;
}

export const EnhancedFactCheckReport: React.FC<EnhancedFactCheckReportProps> = ({ report: tieredFactCheckResult }) => {
  const { report } = tieredFactCheckResult;
  return (
    <div className="p-6 bg-gray-50 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Fact-Check Report</h2>

      <div className="mb-6">
        <h3 className="text-xl font-semibold">Overall Summary</h3>
        <p className="text-gray-700">{report.summary}</p>
        <p className="text-lg font-bold mt-2">
          Overall Authenticity Score:
          <span className="text-blue-600">{report.overallAuthenticityScore}%</span>
        </p>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">Claim Analysis</h3>
        <div className="space-y-4">
          {report.claimVerifications.map((claim) => (
            <EnhancedClaimAnalysis key={claim.id} claim={claim} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnhancedFactCheckReport;
