import React from 'react';
import type { SourceAnalysis } from '../../types/verification';

interface SourceBreakdownTableProps {
  sources: SourceAnalysis[];
}

const SourceBreakdownTable: React.FC<SourceBreakdownTableProps> = ({ sources }) => {
  if (sources.length === 0) {
    return null; // Don't render anything if there are no sources
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left text-slate-400">
        <thead className="text-xs text-slate-300 uppercase bg-slate-700/50">
          <tr>
            <th scope="col" className="px-6 py-3">Source</th>
            <th scope="col" className="px-6 py-3">Type</th>
            <th scope="col" className="px-6 py-3">Overall Score</th>
            <th scope="col" className="px-6 py-3">Summary</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source, index) => (
            <tr key={index} className="bg-slate-800/60 border-b border-slate-700">
              <th scope="row" className="px-6 py-4 font-medium text-slate-200 whitespace-nowrap">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{source.name}</a>
              </th>
              <td className="px-6 py-4 capitalize">{source.type}</td>
              <td className="px-6 py-4 font-bold">{source.credibility.overallScore.toFixed(0)}</td>
              <td className="px-6 py-4">{source.credibility.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SourceBreakdownTable;
