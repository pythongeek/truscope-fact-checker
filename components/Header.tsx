import React from 'react';
import { SparklesIcon, KeyIcon, CheckCircleIcon } from './icons';

interface HeaderProps {
  onApiKeyClick: () => void;
  hasUserApiKey: boolean;
}

const Header: React.FC<HeaderProps> = ({ onApiKeyClick, hasUserApiKey }) => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              TruScope AI
            </h1>
          </div>
          <button
            onClick={onApiKeyClick}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center space-x-2 ${
              hasUserApiKey
                ? 'bg-green-800/50 text-green-300 hover:bg-green-700/50'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
            }`}
          >
            {hasUserApiKey ? (
              <CheckCircleIcon className="w-5 h-5" />
            ) : (
              <KeyIcon className="w-5 h-5" />
            )}
            <span>{hasUserApiKey ? 'API Key Set' : 'Set API Key'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
