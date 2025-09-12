import React, { useState } from 'react';
import type { AtomicStatement } from '../types/granularity';
import type { FactCheckResult } from '../types/preCheck';
import { checkForFactCheck } from '../services/preCheckService';
import { SearchOrchestrator } from '../services/verification/searchOrchestrator';
import { GoogleGenerativeAI } from "@google/generative-ai";
import LoadingSpinner from './LoadingSpinner';
import PreCheckResult from './PreCheckResult';
import SourceVerification from './SourceVerification';
import type { SearchResult } from '../types/verification';

interface GranulatedAnalysisProps {
  atomicStatements: AtomicStatement[] | null;
  isLoading: boolean;
}

interface PreCheckState {
  isLoading: boolean;
  error: string | null;
  result: FactCheckResult | null;
}

interface VerificationState {
  isLoading: boolean;
  error: string | null;
  result: SearchResult | null;
  progress: number;
  status: string;
}

const getEntityTypeColor = (type: string) => {
  switch (type) {
    case 'PERSON':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/50';
    case 'ORGANIZATION':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
    case 'LOCATION':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
    case 'DATE':
      return 'bg-teal-500/20 text-teal-300 border-teal-500/50';
    case 'EVENT':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50';
    default:
      return 'bg-slate-600/20 text-slate-300 border-slate-500/50';
  }
};

const GranulatedAnalysis: React.FC<GranulatedAnalysisProps> = ({ atomicStatements, isLoading }) => {
  const [preCheckData, setPreCheckData] = useState<Record<number, PreCheckState>>({});
  const [verificationData, setVerificationData] = useState<Record<number, VerificationState>>({});

  const handlePreCheckClick = async (claim: string, index: number) => {
    setPreCheckData(prev => ({
      ...prev,
      [index]: { isLoading: true, error: null, result: null }
    }));

    try {
      const result = await checkForFactCheck(claim);
      setPreCheckData(prev => ({
        ...prev,
        [index]: { isLoading: false, error: null, result }
      }));
    } catch (err) {
      setPreCheckData(prev => ({
        ...prev,
        [index]: { isLoading: false, error: err instanceof Error ? err.message : 'An unknown error occurred.', result: null }
      }));
    }
  };

  const handleVerifyClick = async (claim: string, index: number) => {
    const apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      // In a real app, you'd probably trigger a modal to ask for the key
      console.error("API key not found");
      return;
    }
    const geminiClient = new GoogleGenerativeAI(apiKey);
    const orchestrator = new SearchOrchestrator(geminiClient);

    setVerificationData(prev => ({
      ...prev,
      [index]: { isLoading: true, error: null, result: null, progress: 0, status: 'Initializing...' }
    }));

    try {
      const result = await orchestrator.verifyClaimWithSources(
        claim,
        undefined,
        (progress, status) => {
          setVerificationData(prev => ({
            ...prev,
            [index]: { ...prev[index], isLoading: true, progress, status }
          }));
        }
      );
      setVerificationData(prev => ({
        ...prev,
        [index]: { isLoading: false, error: null, result, progress: 100, status: 'Complete' }
      }));
    } catch (err) {
      setVerificationData(prev => ({
        ...prev,
        [index]: {
          isLoading: false,
          error: err instanceof Error ? err.message : 'An unknown error occurred.',
          result: null,
          progress: 100,
          status: 'Error'
        }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-24">
        <LoadingSpinner />
        <span className="ml-4 text-slate-400">Analyzing statement...</span>
      </div>
    );
  }

  if (!atomicStatements) {
    return null;
  }

  if (atomicStatements.length === 0) {
    return <p className="text-center text-slate-400 mt-4">No atomic statements could be extracted.</p>;
  }

  return (
    <div className="mt-4 space-y-3 pl-6 border-l-2 border-slate-700">
      {atomicStatements.map((item, index) => {
        const preCheckState = preCheckData[index];
        const verificationState = verificationData[index];
        return (
          <div key={index} className="p-3 rounded-lg bg-slate-800/60">
            <div className="flex justify-between items-start gap-2">
              <p className="text-slate-300 font-medium flex-1">{item.statement}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePreCheckClick(item.statement, index)}
                  disabled={preCheckState?.isLoading || verificationState?.isLoading}
                  className="px-2 py-1 text-xs font-semibold bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                  {preCheckState?.isLoading ? 'Checking...' : 'Pre-Check'}
                </button>
                <button
                  onClick={() => handleVerifyClick(item.statement, index)}
                  disabled={verificationState?.isLoading || preCheckState?.isLoading}
                  className="px-2 py-1 text-xs font-semibold bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >
                  {verificationState?.isLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
            {item.entities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.entities.map((entity, entityIndex) => (
                  <div key={entityIndex} className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getEntityTypeColor(entity.type)}`}>
                    <span className="font-bold mr-1.5">{entity.type}</span>
                    {entity.text}
                  </div>
                ))}
              </div>
            )}
            {preCheckState && (
              <PreCheckResult
                result={preCheckState.result}
                isLoading={preCheckState.isLoading}
              />
            )}
            {verificationState && (
              <SourceVerification
                result={verificationState.result}
                isLoading={verificationState.isLoading}
                progress={verificationState.progress}
                status={verificationState.status}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GranulatedAnalysis;
