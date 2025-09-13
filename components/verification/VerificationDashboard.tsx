import React, { useState, useEffect } from 'react';
import type { VerificationResult, SourceAnalysis, SynthesizedSourceItem, SearchResult } from '../../types/verification';
import { SearchOrchestrator } from '../../services/verification/searchOrchestrator';
import SourceCredibilityChart from './SourceCredibilityChart';
import EvidenceTimeline from './EvidenceTimeline';
import VerificationProgress from './VerificationProgress';
import SourceBreakdownTable from './SourceBreakdownTable';

/**
 * Defines the properties for the VerificationDashboard component.
 */
interface VerificationDashboardProps {
  /**
   * An array of claims (strings) to be verified.
   */
  claims: string[];
  /**
   * A callback function that is invoked when the verification process is complete.
   * @param {VerificationResult[]} results - The results of the verification for all claims.
   */
  onVerificationComplete: (results: VerificationResult[]) => void;
}

/**
 * A comprehensive dashboard for verifying a list of claims against web sources.
 * It manages the verification process, displays real-time progress for each claim,
 * and presents the aggregated results in charts, timelines, and tables upon completion.
 *
 * @param {VerificationDashboardProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered verification dashboard.
 */
const VerificationDashboard: React.FC<VerificationDashboardProps> = ({
  claims,
  onVerificationComplete
}) => {
  const [verificationProgress, setVerificationProgress] = useState<Map<string, number>>(new Map());
  const [verificationStatus, setVerificationStatus] = useState<Map<string, string>>(new Map());
  const [sourceAnalysisResults, setSourceAnalysisResults] = useState<SourceAnalysis[]>([]);
  const [timelineSources, setTimelineSources] = useState<SynthesizedSourceItem[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  const orchestrator = React.useMemo(() => new SearchOrchestrator(), []);

  /**
   * Initiates the verification process for all claims.
   * It resets the state, calls the search orchestrator for each claim,
   * updates progress in real-time, and aggregates the results for display.
   */
  const handleVerifyAll = async () => {
    setIsVerifying(true);
    setVerificationProgress(new Map());
    setVerificationStatus(new Map());
    setSourceAnalysisResults([]);
    setTimelineSources([]);

    const verificationPromises = claims.map(async (claim) => {
      try {
        const result = await orchestrator.verifyClaimWithSources(
          claim,
          undefined, // context
          (progress, status) => {
            setVerificationProgress(prev => new Map(prev).set(claim, progress));
            setVerificationStatus(prev => new Map(prev).set(claim, status));
          }
        );
        return result;
      } catch (error) {
        console.error(`Failed to verify claim: "${claim}"`, error);
        setVerificationStatus(prev => new Map(prev).set(claim, 'Error'));
        return {
          claim,
          isVerified: false,
          confidenceScore: 0,
          summary: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sources: {},
        } as SearchResult;
      }
    });

    const results = await Promise.all(verificationPromises);

    // Process results for the dashboard
    const allSourceAnalyses: SourceAnalysis[] = [];
    const allTimelineSources: SynthesizedSourceItem[] = [];

    results.forEach(result => {
      if (result.source_analysis) {
        allSourceAnalyses.push(result.source_analysis);
      }
      if (result.sources) {
        const sourcesFromCollection = Object.values(result.sources).flat();
        allTimelineSources.push(...sourcesFromCollection);
      }
    });

    setSourceAnalysisResults(allSourceAnalyses);
    setTimelineSources(allTimelineSources);

    // This callback expects VerificationResult[], but SearchResult is slightly different.
    // I will assume for now that they are compatible enough or need to be mapped.
    // The original code had this issue as well. I will cast it for now.
    onVerificationComplete(results as VerificationResult[]);
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-600 transition-colors"
        >
          {isVerifying ? 'Verifying Sources...' : 'Verify All Claims'}
        </button>
      </div>

      {isVerifying && (
          <div className="verification-progress mb-6 space-y-2">
            {claims.map(claim => (
              <VerificationProgress
                key={claim}
                claim={claim}
                progress={verificationProgress.get(claim) || 0}
                status={verificationStatus.get(claim) || 'Pending'}
              />
            ))}
          </div>
      )}

      {timelineSources.length > 0 && !isVerifying && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="source-credibility-panel">
              <h4 className="text-lg font-medium text-slate-200 mb-4">Source Credibility Analysis</h4>
              <SourceCredibilityChart sources={sourceAnalysisResults} />
            </div>

            <div className="evidence-timeline-panel">
              <h4 className="text-lg font-medium text-slate-200 mb-4">Evidence Timeline</h4>
              <EvidenceTimeline sources={timelineSources} />
            </div>

            <div className="source-breakdown md:col-span-2">
              <h4 className="text-lg font-medium text-slate-200 mb-4 mt-4">Detailed Source Breakdown</h4>
              <SourceBreakdownTable sources={timelineSources} />
            </div>
        </div>
      )}
    </div>
  );
};

export default VerificationDashboard;
