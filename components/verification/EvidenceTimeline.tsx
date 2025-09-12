import React from 'react';
import type { SourceAnalysis } from '../../types/verification';

interface EvidenceTimelineProps {
  sources: SourceAnalysis[];
}

const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({ sources }) => {
  if (sources.length === 0) {
    return <p className="text-slate-400 text-center py-8">No evidence to display.</p>;
  }

  // A real implementation would parse and sort by date properly
  const sortedSources = [...sources].sort((a, b) => (a.credibility.criteria.RECENCY.score > b.credibility.criteria.RECENCY.score ? -1 : 1));

  return (
    <div className="relative border-l-2 border-slate-700 pl-6">
      {sortedSources.map((source, index) => (
        <div key={index} className="mb-8">
          <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.5 border-2 border-slate-900"></div>
          <p className="text-sm font-semibold text-slate-300">{source.name}</p>
          <p className="text-xs text-slate-500">{source.type}</p>
          <p className="text-sm text-slate-400 mt-1">"{source.content}"</p>
        </div>
      ))}
    </div>
  );
};

export default EvidenceTimeline;
