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
    <div className="space-y-6">
      {/* User Category Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300">
          I am a:
        </label>
        <select
          value={userCategory}
          onChange={(e) => onUserCategoryChange?.(e.target.value as UserCategory)}
          className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200"
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
      <div className="space-y-4">
        <label className="text-sm font-medium text-slate-300">
          Analysis Method:
        </label>

        {(['comprehensive', 'temporal-verification'] as FactCheckMethod[]).map((method) => {
          const capability = getMethodCapabilities(method);
          const isRecommended = method === recommendedMethod;

          return (
            <div
              key={method}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedMethod === method
                  ? 'border-indigo-500 bg-slate-800'
                  : 'border-slate-700 hover:border-slate-600'
              } ${isRecommended ? 'ring-2 ring-green-500/50' : ''}`}
              onClick={() => onMethodChange(method)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    checked={selectedMethod === method}
                    onChange={() => onMethodChange(method)}
                    className="text-indigo-600 bg-slate-700 border-slate-600 focus:ring-indigo-500"
                  />
                  <h3 className="font-semibold text-slate-100">
                    {capability.name}
                  </h3>
                  {isRecommended && (
                    <span className="px-2 py-1 text-xs bg-green-500/10 text-green-300 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    capability.processingTime === 'fast' ? 'bg-green-500/10 text-green-300' :
                    capability.processingTime === 'medium' ? 'bg-yellow-500/10 text-yellow-300' :
                    'bg-red-500/10 text-red-300'
                  }`}>
                    {capability.processingTime}
                  </span>
                  <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-300 rounded-full">
                    {capability.accuracyLevel}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-400 mb-3">
                {capability.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 className="font-medium text-slate-300 mb-1">Strengths:</h4>
                  <ul className="space-y-1 text-slate-400">
                    {capability.strengths.slice(0, 3).map((strength, idx) => (
                      <li key={idx} className="flex items-center">
                        <span className="w-1 h-1 bg-green-500 rounded-full mr-2"></span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-slate-300 mb-1">Features:</h4>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(capability.features)
                      .filter(([_, enabled]) => enabled)
                      .map(([feature, _]) => (
                        <span
                          key={feature}
                          className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-xs"
                        >
                          {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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