import React from 'react';
import { FactCheckMethod, UserCategory } from '../types/factCheck';
import { getMethodCapabilities, getRecommendedMethod } from '../services/methodCapabilities';

interface MethodSelectorProps {
  selectedMethod: FactCheckMethod;
  onMethodChange: (method: FactCheckMethod) => void;
  userCategory?: UserCategory;
  onUserCategoryChange?: (category: UserCategory) => void;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({
  selectedMethod,
  onMethodChange,
  userCategory = 'general',
  onUserCategoryChange
}) => {
  const recommendedMethod = getRecommendedMethod(userCategory);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
      {/* User Category Selection */}
      <div className="md:col-span-1 space-y-3">
        <label className="text-lg font-semibold text-slate-200">
          I am a:
        </label>
        <p className="text-sm text-slate-400">Select your role to get a tailored analysis recommendation.</p>
        <select
          value={userCategory}
          onChange={(e) => onUserCategoryChange?.(e.target.value as UserCategory)}
          className="w-full p-3 bg-slate-900/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 text-base"
        >
          <option value="general">General User</option>
          <option value="journalist">Journalist / News Reporter</option>
          <option value="content-writer">Content Writer</option>
          <option value="blogger">Blogger</option>
          <option value="technical-writer">Technical Writer</option>
          <option value="researcher">Researcher / Academic</option>
        </select>
      </div>

      {/* Method Selection */}
      <div className="md:col-span-2 space-y-4">
        <label className="text-lg font-semibold text-slate-200">
          Analysis Method:
        </label>

        {(['comprehensive', 'temporal-verification'] as FactCheckMethod[]).map((method) => {
          const capability = getMethodCapabilities(method);
          const isRecommended = method === recommendedMethod;

          return (
            <div
              key={method}
              className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 relative overflow-hidden ${
                selectedMethod === method
                  ? 'border-indigo-500 bg-slate-800/60 shadow-lg shadow-indigo-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
              }`}
              onClick={() => onMethodChange(method)}
            >
              {isRecommended && (
                <div className="absolute top-0 right-0 text-xs bg-green-500 text-white font-bold px-4 py-1 rounded-bl-lg">
                  Recommended
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <input
                    type="radio"
                    checked={selectedMethod === method}
                    onChange={() => onMethodChange(method)}
                    className="h-5 w-5 text-indigo-500 bg-slate-700 border-slate-600 focus:ring-indigo-500 focus:ring-offset-slate-800"
                  />
                  <h3 className="font-semibold text-lg text-slate-100">
                    {capability.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2 py-1 rounded-full font-medium ${
                    capability.processingTime === 'fast' ? 'bg-green-500/10 text-green-300' :
                    capability.processingTime === 'medium' ? 'bg-yellow-500/10 text-yellow-300' :
                    'bg-red-500/10 text-red-300'
                  }`}>
                    {capability.processingTime}
                  </span>
                  <span className="px-2 py-1 bg-sky-500/10 text-sky-300 rounded-full font-medium">
                    {capability.accuracyLevel}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-400 mb-4 ml-9">
                {capability.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm ml-9 border-t border-slate-700/50 pt-4">
                <div>
                  <h4 className="font-semibold text-slate-300 mb-2">Strengths:</h4>
                  <ul className="space-y-2 text-slate-400">
                    {capability.strengths.slice(0, 3).map((strength, idx) => (
                      <li key={idx} className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-300 mb-2">Key Features:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(capability.features)
                      .filter(([_, enabled]) => enabled)
                      .map(([feature, _]) => (
                        <span
                          key={feature}
                          className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs font-medium"
                        >
                          {feature.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};