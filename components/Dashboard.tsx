import React, { useState } from 'react';
import type { AnalysisResult } from '../types';
import ScoreCard from './ScoreCard';
import ClaimsAnalysis from './ClaimsAnalysis';
import Sources from './Sources';
import { ClipboardIcon, CheckIcon } from './icons';

interface DashboardProps {
  result: AnalysisResult | null;
  isLoading: boolean;
}

const SummarySkeleton: React.FC = () => (
    <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-full"></div>
        <div className="h-4 bg-slate-700 rounded w-full"></div>
        <div className="h-4 bg-slate-700 rounded w-5/6"></div>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ result, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'claims'>('summary');
  const [summaryCopied, setSummaryCopied] = useState<boolean>(false);

  const tabButtonStyle = 'px-4 py-2 font-medium rounded-t-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500';
  const activeTabStyle = 'bg-slate-800/50 border-slate-700 border-b-transparent text-white';
  const inactiveTabStyle = 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border-transparent';

  const handleCopySummary = () => {
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <ScoreCard score={result?.overallScore} isLoading={isLoading} />
        </div>
        <div className="md:col-span-2 flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b border-slate-700">
            <nav className="-mb-px flex space-x-1" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('summary')}
                className={`${tabButtonStyle} ${activeTab === 'summary' ? activeTabStyle : inactiveTabStyle}`}
                aria-current={activeTab === 'summary' ? 'page' : undefined}
                role="tab"
                aria-selected={activeTab === 'summary'}
                aria-controls="summary-panel"
                id="summary-tab"
              >
                Analysis Summary
              </button>
              <button
                onClick={() => setActiveTab('claims')}
                className={`${tabButtonStyle} ${activeTab === 'claims' ? activeTabStyle : inactiveTabStyle}`}
                aria-current={activeTab === 'claims' ? 'page' : undefined}
                role="tab"
                aria-selected={activeTab === 'claims'}
                aria-controls="claims-panel"
                id="claims-tab"
              >
                Claims Breakdown
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-slate-800/50 rounded-b-xl rounded-tr-xl p-6 border border-slate-700 border-t-0 flex-grow">
            {activeTab === 'summary' && (
              <div id="summary-panel" role="tabpanel" aria-labelledby="summary-tab">
                {isLoading ? <SummarySkeleton /> : (
                  <div className="relative group animate-fade-in">
                    <p className="text-slate-300 pr-12">{result?.summary}</p>
                    <button
                      onClick={handleCopySummary}
                      className="absolute top-0 right-0 p-2 text-slate-400 bg-slate-700/50 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-300 hover:text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed"
                      aria-label={summaryCopied ? 'Summary copied to clipboard' : 'Copy summary to clipboard'}
                      disabled={summaryCopied}
                    >
                      {summaryCopied ? (
                        <div className="flex items-center text-green-400">
                          <CheckIcon className="w-4 h-4" />
                          <span className="text-xs ml-1 font-semibold">Copied!</span>
                        </div>
                      ) : (
                        <ClipboardIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'claims' && (
              <div id="claims-panel" role="tabpanel" aria-labelledby="claims-tab">
                <ClaimsAnalysis claims={result?.claims ?? []} isLoading={isLoading} />
              </div>
            )}
          </div>
        </div>
      </div>
      {!isLoading && result?.sources && result.sources.length > 0 && <Sources sources={result.sources} />}
    </div>
  );
};

export default Dashboard;