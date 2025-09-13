// AI CODING INSTRUCTION: Create a sophisticated progress tracking component
// that shows detailed verification steps with visual progress indicators

import React, { useEffect, useState } from 'react';
import type { VerificationStep, VerificationResult } from '../../types/verification';
import { CheckCircleIcon } from '../icons';

/**
 * Defines the properties for the VerificationProgress component.
 */
interface VerificationProgressProps {
  /**
   * The claim text that is being verified.
   */
  claim: string;
  /**
   * The overall progress of the verification, from 0 to 100.
   */
  progress: number;
  /**
   * A string describing the current status of the verification process.
   */
  status: string;
  /**
   * An optional callback function that is called when the verification is complete.
   * @param {VerificationResult} result - The final result of the verification.
   */
  onComplete?: (result: VerificationResult) => void;
}

/**
 * An array of objects defining the steps in the verification process.
 * Each step has an ID, a user-friendly label, and a weight that contributes
 * to the total progress calculation.
 */
const VERIFICATION_STEPS: VerificationStep[] = [
  { id: 'analysis', label: 'Analyzing Claim', weight: 10 },
  { id: 'strategy', label: 'Generating Search Strategies', weight: 15 },
  { id: 'search', label: 'Searching Multiple Sources', weight: 30 },
  { id: 'extraction', label: 'Extracting Relevant Information', weight: 20 },
  { id: 'scoring', label: 'Evaluating Source Credibility', weight: 15 },
  { id: 'synthesis', label: 'Synthesizing Verification Report', weight: 10 }
];

/**
 * A component that displays detailed, step-by-step progress for the verification of a single claim.
 * It features an overall progress bar and a list of individual verification steps,
 * each with its own status icon and description.
 *
 * @param {VerificationProgressProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered verification progress indicator.
 */
const VerificationProgress: React.FC<VerificationProgressProps> = ({
  claim,
  progress,
  status,
}) => {
  const [currentStep, setCurrentStep] = useState<VerificationStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [stepDetails, setStepDetails] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Determine current step based on progress
    let cumulativeWeight = 0;
    let activeStep = null;

    for (const step of VERIFICATION_STEPS) {
      cumulativeWeight += step.weight;
      if (progress < cumulativeWeight) {
        activeStep = step;
        break;
      }
      if (!completedSteps.includes(step.id)) {
        setCompletedSteps(prev => [...prev, step.id]);
      }
    }

    if (progress >= 100) {
        setCompletedSteps(VERIFICATION_STEPS.map(s => s.id));
        activeStep = null;
    }

    setCurrentStep(activeStep);
  }, [progress, completedSteps]);

  /**
   * Returns the appropriate icon for a given verification step based on its status.
   * @param {VerificationStep} step - The verification step object.
   * @returns {JSX.Element} A status icon (completed, in-progress, or pending).
   */
  const getStepIcon = (step: VerificationStep): JSX.Element => {
    if (completedSteps.includes(step.id)) {
      return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
    }
    if (currentStep?.id === step.id) {
      return <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
    }
    return <div className="w-5 h-5 border-2 border-slate-600 rounded-full" />;
  };

  /**
   * Determines the status of a verification step (completed, active, or pending).
   * @param {VerificationStep} step - The verification step object.
   * @returns {string} The status string.
   */
  const getStepStatus = (step: VerificationStep): string => {
    if (completedSteps.includes(step.id)) return 'completed';
    if (currentStep?.id === step.id) return 'active';
    return 'pending';
  };

  return (
    <div className="verification-progress-container mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
      {/* Claim Header */}
      <div className="claim-header mb-4">
        <h4 className="text-sm font-medium text-slate-200 truncate" title={claim}>
          {claim.length > 80 ? `${claim.substring(0, 80)}...` : claim}
        </h4>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400">{status}</span>
          <span className="text-xs font-medium text-blue-400">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="progress-bar-container mb-4">
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Detailed Step Progress */}
      <div className="steps-container space-y-2">
        {VERIFICATION_STEPS.map(step => {
          const stepStatus = getStepStatus(step);
          const stepDetail = stepDetails.get(step.id) || '';

          return (
            <div key={step.id} className={`step-item flex items-start space-x-3 p-2 rounded transition-colors ${
              stepStatus === 'active' ? 'bg-blue-900/20 border border-blue-600/30' :
              stepStatus === 'completed' ? 'bg-green-900/20' :
              'bg-slate-800/30'
            }`}>
              <div className="step-icon flex-shrink-0 mt-0.5">
                {getStepIcon(step)}
              </div>
              <div className="step-content flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    stepStatus === 'completed' ? 'text-green-400' :
                    stepStatus === 'active' ? 'text-blue-400' :
                    'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {step.weight}%
                  </span>
                </div>
                {stepDetail && stepStatus === 'active' && (
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {stepDetail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Summary */}
      {progress >= 100 && (
        <div className="completion-summary mt-4 p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              Verification Complete
            </span>
          </div>
          <div className="text-xs text-green-300 mt-1">
            Sources analyzed and credibility assessment ready
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationProgress;
