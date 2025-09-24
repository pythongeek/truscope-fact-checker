import React from 'react';
import { SearchEvidence } from '../types';

interface SearchResultsProps {
    searchEvidence?: SearchEvidence;
}

const Highlight: React.FC<{ text: string; query?: string }> = ({ text, query }) => {
    if (!query || !query.trim()) {
      return <>{text}</>;
    }
  
    // Escape regex special characters, split into terms, and filter out empty strings
    const terms = query
      .split(/\s+/)
      .filter(Boolean)
      .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
    if (terms.length === 0) {
      return <>{text}</>;
    }
  
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts = text.split(regex);
  
    return (
      <>
        {parts.map((part, index) =>
          // When splitting with a capturing group, the matched delimiters
          // are spliced into the array at odd indices.
          index % 2 === 1 ? (
            <mark key={index} className="bg-indigo-500/30 text-indigo-200 px-0.5 rounded-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
};


const SearchResults: React.FC<SearchResultsProps> = ({ searchEvidence }) => {
    if (!searchEvidence || !searchEvidence.results || searchEvidence.results.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-2xl text-center">
                <p className="text-slate-400">No relevant web search results were found for this analysis.</p>
            </div>
        );
    }

    const { query, results } = searchEvidence;

    return (
        <div className="bg-slate-800/50 p-4 rounded-2xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-100 px-2">Web Search Corroboration</h3>
            {results.map((result, index) => (
                <div key={index} className="bg-slate-900/50 p-4 rounded-lg">
                    <a 
                        href={result.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-base font-semibold text-indigo-400 hover:underline"
                    >
                        <Highlight text={result.title} query={query} />
                    </a>
                    <p className="text-xs text-green-400 mt-1 truncate">{result.link}</p>
                    <p className="text-slate-300 mt-2 text-sm">
                        <Highlight text={result.snippet} query={query} />
                    </p>
                </div>
            ))}
        </div>
    );
};

export default SearchResults;