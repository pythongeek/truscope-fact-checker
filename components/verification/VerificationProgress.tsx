import React from 'react';

interface VerificationProgressProps {
  claim: string;
  progress: number;
  status: string;
}

const VerificationProgress: React.FC<VerificationProgressProps> = ({ claim, progress, status }) => {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-300 truncate">{claim}</p>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{status}</span>
        <span className="text-xs font-semibold text-blue-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default VerificationProgress;
