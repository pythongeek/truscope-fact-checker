import React from 'react';

interface EnhancedClaimAnalysisProps {
  text: string;
}

const EnhancedClaimAnalysis: React.FC<EnhancedClaimAnalysisProps> = ({ text }) => {
  // Add null/undefined check and provide fallback
  if (!text || typeof text !== 'string') {
    return (
      <div className="bg-slate-800/50 p-6 rounded-lg text-center">
        <div className="text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-300">Enhanced Analysis Unavailable</h3>
        <p className="text-slate-400 max-w-md mx-auto">
          Enhanced claim analysis with highlighted text is not available for this analysis method.
        </p>
      </div>
    );
  }

  const parts = text.split(/(\[.*?\])/g);

  const renderPart = (part: string, index: number) => {
    // Check for our custom markdown
    if (part.startsWith('[') && part.endsWith(']')) {
      const content = part.slice(1, -1);
      const colonIndex = content.indexOf(':');
      
      if (colonIndex === -1) {
        // No colon found, render as plain text
        return <span key={index}>{part}</span>;
      }
      
      const type = content.substring(0, colonIndex);
      const value = content.substring(colonIndex + 1);

      switch (type) {
        case 'claim':
          return <span key={index} className="text-purple-400 font-bold">{value}</span>;
        case 'source':
          return <span key={index} className="text-blue-400 font-bold">{value}</span>;
        case 'discrepancy':
          return <span key={index} className="text-yellow-400 font-bold">{value}</span>;
        case 'unverified':
          return <span key={index} className="text-red-400 font-bold">{value}</span>;
        default:
          return <span key={index}>{part}</span>;
      }
    }
    return <span key={index}>{part}</span>;
  };

  return (
    <div className="bg-slate-900/50 p-4 rounded-lg">
      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
        {parts.map(renderPart)}
      </p>
    </div>
  );
};

export default EnhancedClaimAnalysis;
