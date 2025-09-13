import React from 'react';
import type { SearchResult } from '../types/verification';
import LoadingSpinner from './LoadingSpinner';

/**
 * Defines the properties for the SourceVerification component.
 */
interface SourceVerificationProps {
  /**
   * The search result object containing verification details.
   * If null, the component will render nothing unless isLoading is true.
   */
  result: SearchResult | null;
  /**
   * If true, the component will display a loading state with a progress bar.
   */
  isLoading: boolean;
  /**
   * The current progress of the verification process (0-100).
   */
  progress: number;
  /**
   * A status message to display during the loading process.
   */
  status: string;
}

/**
 * Determines the color for the verification verdict text based on verification status and confidence.
 * @param {boolean} isVerified - Whether the claim is verified.
 * @param {number} confidence - The confidence score of the verification.
 * @returns {string} A Tailwind CSS class for the text color.
 */
const getVerdictColor = (isVerified: boolean, confidence: number) => {
  if (confidence < 50) return 'text-yellow-400';
  return isVerified ? 'text-green-400' : 'text-red-400';
};

/**
 * Determines the border color for an evidence item based on its credibility score.
 * @param {number} score - The credibility score of the evidence.
 * @returns {string} A Tailwind CSS class for the border color.
 */
const getCredibilityColor = (score: number) => {
  if (score > 80) return 'border-green-500';
  if (score > 60) return 'border-yellow-500';
  return 'border-red-500';
};

/**
 * A component that displays the results of a source verification check for a single claim.
 * It shows a loading indicator during verification and then presents a report including
 * a verdict, summary, and a list of evidence that was considered.
 *
 * @param {SourceVerificationProps} props - The properties for the SourceVerification component.
 * @returns {JSX.Element | null} The rendered source verification report, loading state, or null.
 */
const SourceVerification: React.FC<SourceVerificationProps> = ({ result, isLoading, progress, status }) => {
  if (isLoading) {
    return (
      <div className="p-4 mt-4 bg-slate-800/60 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-slate-300">Verifying with sources...</h4>
          <span className="text-sm font-bold text-blue-400">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-center text-sm text-slate-400 mt-2">{status}</p>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="p-4 mt-4 bg-slate-800/60 rounded-lg border-l-4 border-blue-500">
      <h4 className="font-semibold text-blue-300 mb-2">Source Verification Report</h4>
      <div className="flex items-baseline space-x-2">
        <p className={`text-lg font-bold ${getVerdictColor(result.isVerified, result.confidenceScore)}`}>
          {result.isVerified ? 'Verified' : 'Unverified'}
        </p>
        <span className="text-sm text-slate-400">(Confidence: {result.confidenceScore.toFixed(0)}%)</span>
      </div>
      <p className="text-slate-300 mt-1">{result.summary}</p>

      <h5 className="font-semibold text-slate-300 mt-4 mb-2">Evidence Considered:</h5>
      <div className="space-y-3">
        {result.evidence.filter(e => e.isRelevant).map((item, index) => (
          <div key={index} className={`p-3 rounded-lg bg-slate-900/50 border-l-4 ${getCredibilityColor(item.credibilityScore)}`}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-400 hover:underline">
              {item.title}
            </a>
            <p className="text-xs text-slate-500">{item.url}</p>
            <p className="text-sm text-slate-400 mt-1">"{item.snippet}"</p>
            <p className="text-right text-xs font-semibold text-slate-400 mt-1">
              Credibility: {item.credibilityScore.toFixed(0)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourceVerification;
