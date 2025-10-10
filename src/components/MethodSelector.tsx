import React from 'react';
import { PublishingContext } from '../types';

interface MethodSelectorProps {
  publishingContext: PublishingContext;
  onPublishingContextChange: (context: PublishingContext) => void;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({
  publishingContext,
  onPublishingContextChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Publishing Context Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">
          Publishing Context:
        </label>
        <select
          value={publishingContext}
          onChange={(e) => onPublishingContextChange(e.target.value as PublishingContext)}
          className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200"
        >
          <option value="journalism">Journalism</option>
          <option value="editorial">Editorial</option>
          <option value="content">Content</option>
          <option value="technical">Technical</option>
        </select>
      </div>

      {/* AI Engine Note */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">ℹ</span>
          </div>
          <div className="text-sm text-slate-300">
            <p className="font-medium mb-1">About Our AI Engine</p>
            <p className="text-slate-400">
              All fact-checking methods are powered by advanced AI models (Gemini) combined with
              real-time web search and credible source verification. The AI serves as the analytical
              engine, not a separate fact-checking method.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
