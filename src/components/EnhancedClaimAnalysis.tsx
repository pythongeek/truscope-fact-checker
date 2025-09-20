import React from 'react';

interface EnhancedClaimAnalysisProps {
  text: string;
}

const EnhancedClaimAnalysis: React.FC<EnhancedClaimAnalysisProps> = ({ text }) => {
  const parts = text.split(/(\[.*?\])/g);

  const renderPart = (part: string, index: number) => {
    // Check for our custom markdown
    if (part.startsWith('[') && part.endsWith(']')) {
      const content = part.slice(1, -1);
      const [type, ...rest] = content.split(':');
      const value = rest.join(':');

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

  return <p className="text-slate-300 whitespace-pre-wrap">{parts.map(renderPart)}</p>;
};

export default EnhancedClaimAnalysis;
