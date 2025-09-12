import React from 'react';
import type { SourceAnalysis } from '../../types/verification';

interface SourceCredibilityChartProps {
  sources: SourceAnalysis[];
}

const SourceCredibilityChart: React.FC<SourceCredibilityChartProps> = ({ sources }) => {
  if (sources.length === 0) {
    return <p className="text-slate-400 text-center py-8">No sources to display.</p>;
  }

  const maxScore = Math.max(...sources.map(s => s.credibility.overallScore), 100);

  return (
    <div className="space-y-4">
      {sources.map((source, index) => (
        <div key={index} className="flex items-center">
          <div className="w-1/3 text-sm text-slate-300 truncate pr-2">{source.name}</div>
          <div className="w-2/3 bg-slate-700 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full text-xs font-medium text-white text-center p-0.5 leading-none"
              style={{ width: `${(source.credibility.overallScore / maxScore) * 100}%` }}
            >
              {source.credibility.overallScore.toFixed(0)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SourceCredibilityChart;
