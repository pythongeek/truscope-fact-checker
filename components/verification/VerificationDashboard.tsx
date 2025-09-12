import React, { useState, useEffect } from 'react';
import type { VerificationResult, SourceAnalysis } from '../../types/verification';
import { SearchOrchestrator } from '../../services/verification/searchOrchestrator';
import { GoogleGenerativeAI } from "@google/generative-ai";
import SourceCredibilityChart from './SourceCredibilityChart';
import EvidenceTimeline from './EvidenceTimeline';
import VerificationProgress from './VerificationProgress';
import SourceBreakdownTable from './SourceBreakdownTable';

interface VerificationDashboardProps {
  claims: string[];
  onVerificationComplete: (results: VerificationResult[]) => void;
}

const VerificationDashboard: React.FC<VerificationDashboardProps> = ({
  claims,
  onVerificationComplete
}) => {
  const [verificationProgress, setVerificationProgress] = useState<Map<string, number>>(new Map());
  const [verificationStatus, setVerificationStatus] = useState<Map<string, string>>(new Map());
  const [sourceResults, setSourceResults] = useState<SourceAnalysis[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyAll = async () => {
    setIsVerifying(true);
    const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API key not found");
      setIsVerifying(false);
      return;
    }
    const geminiClient = new GoogleGenerativeAI(apiKey);
    const orchestrator = new SearchOrchestrator(geminiClient);

    const verificationPromises = claims.map(async (claim, index) => {
      const result = await orchestrator.verifyClaimWithSources(
        claim,
        undefined,
        (progress, status) => {
          setVerificationProgress(prev => new Map(prev).set(claim, progress));
          setVerificationStatus(prev => new Map(prev).set(claim, status));
        }
      );

      // This is a simplified way to aggregate source analysis results
      // In a real app, you might want to handle this more granularly
      setSourceResults(prev => [...prev, ...result.sourceAnalysis]);
      return result;
    });

    const results = await Promise.all(verificationPromises);
    onVerificationComplete(results);
    setIsVerifying(false);
  };

  return (
    <div className="verification-dashboard bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <div className="dashboard-header mb-6">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">
          Real-time Source Verification
        </h3>
        <button
          onClick={handleVerifyAll}
          disabled={isVerifying}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-600"
        >
          {isVerifying ? 'Verifying Sources...' : 'Verify All Claims'}
        </button>
      </div>

      {/* Real-time Progress Section */}
      <div className="verification-progress mb-6">
        {claims.map(claim => (
          <VerificationProgress
            key={claim}
            claim={claim}
            progress={verificationProgress.get(claim) || 0}
            status={verificationStatus.get(claim) || 'Pending'}
          />
        ))}
      </div>

      {/* Source Credibility Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="source-credibility-panel">
          <h4 className="text-lg font-medium text-slate-200 mb-4">Source Credibility Analysis</h4>
          <SourceCredibilityChart sources={sourceResults} />
        </div>

        <div className="evidence-timeline-panel">
          <h4 className="text-lg font-medium text-slate-200 mb-4">Evidence Timeline</h4>
          <EvidenceTimeline sources={sourceResults} />
        </div>
      </div>

      {/* Detailed Source Breakdown */}
      <div className="source-breakdown mt-6">
        <SourceBreakdownTable sources={sourceResults} />
      </div>
    </div>
  );
};

export default VerificationDashboard;
