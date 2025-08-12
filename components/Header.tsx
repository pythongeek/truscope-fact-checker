
import React from 'react';
import { LogoIcon } from './Icons';

export const Header: React.FC = () => {
  return (
    <header className="text-center mb-8 md:mb-12 animate-entry fade-in">
       <div className="flex justify-center items-center gap-3 mb-2">
        <LogoIcon className="w-10 h-10 text-blue-600" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-800 gradient-text">
          TruScope
        </h1>
      </div>
      <p className="mt-3 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto">
        Combat misinformation with AI-powered fact verification and in-depth news analysis.
      </p>
    </header>
  );
};
