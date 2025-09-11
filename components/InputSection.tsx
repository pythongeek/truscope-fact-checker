import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface InputSectionProps {
  inputText: string;
  setInputText: (text: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ inputText, setInputText, onAnalyze, isLoading }) => {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-slate-100">Analyze Content</h2>
      <p className="text-slate-400 mb-4">
        Paste the text you want to fact-check below. The AI will analyze its claims and provide a credibility report.
      </p>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Enter text to analyze..."
        className="w-full h-48 p-4 bg-slate-900/70 border border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200 text-slate-200 resize-y"
        disabled={isLoading}
      />
      <div className="mt-4 flex justify-end">
        <button
          onClick={onAnalyze}
          disabled={isLoading || !inputText.trim()}
          className="flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              <span className="ml-2">Analyzing...</span>
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </div>
    </div>
  );
};

export default InputSection;
