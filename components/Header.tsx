import React from 'react';
import { SparklesIcon } from './icons';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            TruScope AI
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;
