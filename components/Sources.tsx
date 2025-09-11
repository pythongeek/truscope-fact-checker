import React from 'react';
import type { Source } from '../types';
import { LinkIcon } from './icons';

interface SourcesProps {
  sources: Source[];
}

const Sources: React.FC<SourcesProps> = ({ sources }) => {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 animate-slide-in-up" style={{animationDelay: '0.3s'}}>
      <div className="flex items-center space-x-3 border-b border-slate-700 pb-3 mb-4">
        <LinkIcon className="w-6 h-6 text-slate-400" />
        <h3 className="text-lg font-semibold text-slate-100">Sources Consulted</h3>
      </div>
      <ul className="space-y-3">
        {sources.map((source, index) => (
          <li key={index} className="text-slate-400 flex items-start space-x-2">
            <span className="text-blue-400 pt-1">&#8227;</span>
            <a
              href={source.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 hover:underline transition-colors break-all"
              aria-label={`Read more at ${source.title}`}
            >
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sources;