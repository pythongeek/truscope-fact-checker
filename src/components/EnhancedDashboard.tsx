import React, { useState, useEffect } from 'react';
import { FactCheckReport } from '../types';
import { EnhancedFactCheckService } from '../services/enhancedFactCheckService';
import Dashboard from './Dashboard';
import DashboardSkeleton from './DashboardSkeleton';

interface EnhancedDashboardProps {
  baseReport: FactCheckReport;
  originalText: string;
}

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({
  baseReport,
  originalText
}) => {
  const [enhancedReport, setEnhancedReport] = useState<FactCheckReport | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    enhanceReport();
  }, [baseReport, originalText]);

  const enhanceReport = async () => {
    setIsEnhancing(true);
    setError(null);
    try {
      const enhancedService = new EnhancedFactCheckService();
      // Using the new `orchestrateFactCheck` method.
      // The `method` parameter is set to "comprehensive" as a sensible default.
      const result = await enhancedService.orchestrateFactCheck(originalText, "comprehensive");
      setEnhancedReport(result);
    } catch (err) {
      console.error('Failed to enhance report:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Enhanced Analysis Results</h2>
          <p className="text-slate-300 text-sm">
            Advanced multi-source verification
          </p>
        </div>
      </div>

      {isEnhancing && <DashboardSkeleton />}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg">
          <h3 className="font-bold">Analysis Failed</h3>
          <p>{error}</p>
        </div>
      )}

      {!isEnhancing && enhancedReport && (
        <Dashboard result={enhancedReport} isLoading={false} />
      )}
    </div>
  );
};

export default EnhancedDashboard;
