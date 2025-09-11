import React from 'react';
import { SparklesIcon, KeyIcon } from './icons';

interface HeaderProps {
  onApiKeyClick: () => void;
  hasUserApiKey: boolean;
}

const Header: React.FC<HeaderProps> = ({ onApiKeyClick, hasUserApiKey }) => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              TruScope AI
            </h1>
          </div>
          <button
            onClick={onApiKeyClick}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
              hasUserApiKey
                ? 'bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30'
                : 'bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
            }`}
            aria-label={hasUserApiKey ? 'API key configured' : 'Configure API key'}
          >
            <KeyIcon className="w-4 h-4" />
            <span className="text-sm">
              {hasUserApiKey ? 'API Key Set' : 'Set API Key'}
            </span>
            {hasUserApiKey && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
