
import React from 'react';
import { FileTextIcon } from './Icons';

interface InputSectionProps {
  articleText: string;
  onArticleChange: (text: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onLoadSample: () => void;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({
  articleText,
  onArticleChange,
  onAnalyze,
  onClear,
  onLoadSample,
  isLoading,
}) => {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
        1. Paste Your Article
      </h2>
      <textarea
        value={articleText}
        onChange={(e) => onArticleChange(e.target.value)}
        placeholder="Paste your news article content here for comprehensive fact-checking, misinformation detection, and news standard evaluation..."
        className="w-full h-64 p-4 bg-gray-50 text-gray-800 placeholder:text-gray-500 border-2 border-gray-200 rounded-lg font-serif text-base leading-relaxed resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ease-in-out shadow-sm focus:shadow-md"
        disabled={isLoading}
      />
      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4">
        <button
          onClick={onLoadSample}
          disabled={isLoading}
          className="px-5 py-3 text-base font-semibold text-blue-600 bg-white border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform"
        >
          <FileTextIcon className="w-5 h-5"/>
          Load Sample
        </button>
        <button
          onClick={onClear}
          disabled={isLoading}
          className="px-5 py-3 text-base font-semibold text-gray-700 bg-gray-100 border-2 border-gray-200 rounded-lg hover:bg-gray-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform"
        >
          Clear
        </button>
        <button
          onClick={onAnalyze}
          disabled={isLoading || articleText.length < 100}
          className="px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transform"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Article'}
        </button>
      </div>
       {articleText.length > 0 && articleText.length < 100 && (
         <p className="text-right text-sm text-yellow-600 mt-2">Please enter at least 100 characters for analysis.</p>
       )}
    </div>
  );
};
