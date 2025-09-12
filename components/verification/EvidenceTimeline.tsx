import React from 'react';
import type { SynthesizedSourceItem } from '../../types/verification';

interface EvidenceTimelineProps {
  sources: SynthesizedSourceItem[];
}

const EvidenceTimeline: React.FC<EvidenceTimelineProps> = ({ sources }) => {
  if (!sources || sources.length === 0) {
    return <p className="text-slate-400 text-center py-8">No evidence to display.</p>;
  }

  // Sort sources by publication date, most recent first.
  // Handles potential invalid date strings.
  const sortedSources = [...sources].sort((a, b) => {
    const dateA = new Date(a.publication_date).getTime();
    const dateB = new Date(b.publication_date).getTime();
    if (isNaN(dateA)) return 1; // Invalid dates go to the end
    if (isNaN(dateB)) return -1;
    return dateB - dateA;
  });

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong_support': return 'bg-green-500';
      case 'weak_support': return 'bg-green-700';
      case 'strong_contradiction': return 'bg-red-500';
      case 'weak_contradiction': return 'bg-red-700';
      default: return 'bg-slate-500';
    }
  }

  return (
    <div className="relative border-l-2 border-slate-700 pl-8">
      {sortedSources.map((source, index) => (
        <div key={index} className="mb-6 relative">
          <div className={`absolute w-4 h-4 rounded-full -left-10 border-2 border-slate-900 ${getStrengthColor(source.verification_strength)}`}></div>
          <p className="text-sm font-semibold text-slate-300">
            {source.source_name}
            <a href={source.access_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline ml-2">[link]</a>
          </p>
          <p className="text-xs text-slate-500 mb-1">{new Date(source.publication_date).toLocaleDateString()}</p>
          <p className="text-sm text-slate-400 italic">"{source.relevant_information}"</p>
        </div>
      ))}
    </div>
  );
};

export default EvidenceTimeline;
