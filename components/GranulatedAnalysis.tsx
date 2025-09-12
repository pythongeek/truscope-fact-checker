import React from 'react';
import type { AtomicStatement } from '../types/granularity';
import LoadingSpinner from './LoadingSpinner';

interface GranulatedAnalysisProps {
  atomicStatements: AtomicStatement[] | null;
  isLoading: boolean;
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
      {atomicStatements.map((item, index) => (
        <div key={index} className="p-3 rounded-lg bg-slate-800/60">
          <p className="text-slate-300 font-medium">{item.statement}</p>
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
        </div>
      ))}
    </div>
  );
};

export default GranulatedAnalysis;
