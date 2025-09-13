import React, { useState } from 'react';
import type { Claim } from '../types';
import { ClaimStatus } from '../types';
import { CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon, ChevronDownIcon } from './icons';

/**
 * Defines the properties for the ClaimsAnalysis component.
 */
interface ClaimsAnalysisProps {
  /**
   * An array of claim objects to be analyzed and displayed.
   */
  claims: Claim[];
  /**
   * If true, the component will render a loading skeleton.
   * @default false
   */
  isLoading?: boolean;
}

/**
* A skeleton loader for the ClaimsAnalysis component.
* Displays a pulsing placeholder to indicate that the claims are being loaded.
* @returns {JSX.Element} The rendered skeleton component.
*/
const ClaimsAnalysisSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, index) => (
      <div key={index} className="p-4 rounded-lg bg-slate-800/40 animate-pulse">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 pt-1">
            <div className="w-6 h-6 rounded-full bg-slate-700"></div>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="h-4 bg-slate-700 rounded w-full"></div>
            <div className="h-3 bg-slate-700 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * Returns the visual elements (icon, color, text style) for a given claim status.
 *
 * @param {ClaimStatus} status - The verification status of the claim.
 * @returns {{icon: JSX.Element, color: string, text: string}} An object containing the icon component and Tailwind CSS classes.
 */
const getStatusVisuals = (status: ClaimStatus) => {
  switch (status) {
    case ClaimStatus.VERIFIED:
      return {
        icon: <CheckCircleIcon className="w-6 h-6 text-green-400" aria-hidden="true" />,
        color: 'border-l-4 border-green-500 bg-green-500/15',
        text: 'text-green-400'
      };
    case ClaimStatus.UNCERTAIN:
      return {
        icon: <QuestionMarkCircleIcon className="w-6 h-6 text-yellow-400" aria-hidden="true" />,
        color: 'border-l-4 border-yellow-500 bg-yellow-500/15',
        text: 'text-yellow-400'
      };
    case ClaimStatus.FALSE:
      return {
        icon: <XCircleIcon className="w-6 h-6 text-red-400" aria-hidden="true" />,
        color: 'border-l-4 border-red-500 bg-red-500/15',
        text: 'text-red-400'
      };
    default:
      return {
        icon: <QuestionMarkCircleIcon className="w-6 h-6 text-slate-400" aria-hidden="true" />,
        color: 'border-l-4 border-slate-500 bg-slate-700/30',
        text: 'text-slate-400'
      };
  }
};

/**
 * A component that displays a detailed analysis of a list of claims.
 * Each claim is presented with its verification status, and a collapsible
 * section provides a more detailed explanation.
 *
 * @param {ClaimsAnalysisProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered list of claim analyses or a skeleton loader.
 */
const ClaimsAnalysis: React.FC<ClaimsAnalysisProps> = ({ claims, isLoading = false }) => {
  const [expandedClaims, setExpandedClaims] = useState<Record<number, boolean>>({});

  /**
   * Toggles the expanded/collapsed state of a claim's explanation section.
   * @param {number} index - The index of the claim to toggle.
   */
  const handleToggle = (index: number) => {
    setExpandedClaims(prev => ({ ...prev, [index]: !prev[index] }));
  };

  if (isLoading) {
    return <ClaimsAnalysisSkeleton />;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {claims.length > 0 ? (
        claims.map((claim, index) => {
          const { icon, color, text } = getStatusVisuals(claim.status);
          const isExpanded = !!expandedClaims[index];

          return (
            <div key={index} className={`p-4 rounded-lg ${color} transition-all duration-300`}>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 pt-1">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-200">"{claim.claim}"</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-sm font-medium uppercase tracking-wider ${text}`}>{claim.status}</p>
                    {claim.explanation && (
                      <button
                        onClick={() => handleToggle(index)}
                        className="flex items-center text-sm text-slate-400 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900/50 focus:ring-blue-500 rounded-md p-1 -mr-1"
                        aria-expanded={isExpanded}
                        aria-controls={`claim-explanation-${index}`}
                      >
                        <span className="mr-1 text-xs font-semibold">{isExpanded ? 'Hide' : 'Show'}</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {claim.explanation && (
                    <div
                      id={`claim-explanation-${index}`}
                      className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-screen mt-2 opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                      <p className="text-slate-400">{claim.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-slate-400">No specific claims were identified for detailed analysis.</p>
      )}
    </div>
  );
};

export default ClaimsAnalysis;