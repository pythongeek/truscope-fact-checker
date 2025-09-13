import React from 'react';
import type { SynthesizedSourceItem } from '../../types/verification';

/**
 * Defines the properties for the SourceBreakdownTable component.
 */
interface SourceBreakdownTableProps {
  /**
   * An array of synthesized source items to be displayed in the table.
   */
  sources: SynthesizedSourceItem[];
}

/**
 * A component that displays a detailed table of verification sources.
 * The table includes columns for the source name, its credibility score,
 * the verification finding (strength), and the relevant information extracted.
 *
 * @param {SourceBreakdownTableProps} props - The properties for the SourceBreakdownTable component.
 * @returns {JSX.Element | null} The rendered table of sources, or null if no sources are provided.
 */
const SourceBreakdownTable: React.FC<SourceBreakdownTableProps> = ({ sources }) => {
  if (!sources || sources.length === 0) {
    return null; // Don't render anything if there are no sources
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="min-w-full text-sm text-left text-slate-400">
        <thead className="text-xs text-slate-300 uppercase bg-slate-700/50">
          <tr>
            <th scope="col" className="px-6 py-3">Source</th>
            <th scope="col" className="px-6 py-3">Credibility</th>
            <th scope="col" className="px-6 py-3">Finding</th>
            <th scope="col" className="px-6 py-3">Relevant Information</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source, index) => (
            <tr key={index} className="bg-slate-800/60 border-b border-slate-700 last:border-b-0">
              <th scope="row" className="px-6 py-4 font-medium text-slate-200 whitespace-nowrap">
                <a href={source.access_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {source.source_name}
                </a>
              </th>
              <td className="px-6 py-4">
                <span className="font-bold text-slate-200">{source.credibility_score}</span>
                <span className="text-slate-500">/100</span>
              </td>
              <td className="px-6 py-4 capitalize">{source.verification_strength.replace('_', ' ')}</td>
              <td className="px-6 py-4 text-slate-300">{source.relevant_information}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SourceBreakdownTable;
