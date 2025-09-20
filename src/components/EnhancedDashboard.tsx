import React, { useState, useEffect } from 'react';
import { FactCheckReport } from '../types/factCheck';
import { SmartCorrection } from '../types/corrections';
import { EnhancedFactCheckService } from '../services/enhancedFactCheckService';
import Dashboard from './Dashboard';
import CorrectionsDisplay from './CorrectionsDisplay';

interface EnhancedDashboardProps {
  baseReport: FactCheckReport;
  originalText: string;
}

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({
  baseReport,
  originalText
}) => {
  const [enhancedReport, setEnhancedReport] = useState<FactCheckReport>(baseReport);
  const [corrections, setCorrections] = useState<SmartCorrection[]>([]);
  const [correctionAnalysis, setCorrectionAnalysis] = useState<any>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'corrections'>('report');

  useEffect(() => {
    enhanceReport();
  }, [baseReport]);

  const enhanceReport = async () => {
    setIsEnhancing(true);
    try {
      const enhancedService = new EnhancedFactCheckService();
      const result = await enhancedService.enhanceFactCheckReport(baseReport, originalText);

      setEnhancedReport(result.enhancedReport);
      setCorrections(result.corrections);
      setCorrectionAnalysis(result.correctionAnalysis);
    } catch (error) {
      console.error('Failed to enhance report:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyCorrection = (correctionId: string, selectedPhrasing?: string) => {
    // Implementation for applying corrections
    console.log('Applying correction:', correctionId, selectedPhrasing);
    // This would integrate with the AutoEditor component
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Enhanced Analysis Results</h2>
            <p className="text-slate-300 text-sm">
              Advanced multi-source verification with intelligent corrections
            </p>
          </div>

          {corrections.length > 0 && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg px-3 py-2">
              <span className="text-yellow-300 font-semibold">
                {corrections.length} Correction{corrections.length !== 1 ? 's' : ''} Available
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors ${
            activeTab === 'report'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          Analysis Report
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-colors relative ${
            activeTab === 'corrections'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          Smart Corrections
          {corrections.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {corrections.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {isEnhancing ? (
        <div className="bg-slate-800/50 p-8 rounded-lg text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-slate-100">Enhancing Analysis...</h3>
          <p className="text-slate-300">Gathering additional sources and analyzing for corrections</p>
        </div>
      ) : (
        <>
          {activeTab === 'report' && (
            <Dashboard result={enhancedReport} isLoading={false} />
          )}

          {activeTab === 'corrections' && (
            <CorrectionsDisplay
              corrections={corrections}
              analysis={correctionAnalysis}
              onApplyCorrection={handleApplyCorrection}
            />
          )}
        </>
      )}
    </div>
  );
};

export default EnhancedDashboard;
