import React, { useState, useEffect } from 'react';
import { IFCNComplianceService } from '../../services/compliance/IFCNComplianceService';

interface ComplianceDashboardProps {
  factCheckReport: any;
  originalText: string;
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ factCheckReport, originalText }) => {
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'compliance' | 'corrections'>('compliance');

  useEffect(() => {
    const ifcnService = IFCNComplianceService.getInstance();
    const compliance = ifcnService.assessCompliance(factCheckReport);
    setComplianceReport(compliance);
  }, [factCheckReport, originalText]);

  const renderComplianceTab = () => {
    if (!complianceReport) return <div>Loading compliance analysis...</div>;

    return (
      <div className="space-y-6">
        <div className={`p-6 rounded-2xl border ${
          complianceReport.certificationReadiness === 'ready' ? 'bg-green-500/20 border-green-500/30' :
          complianceReport.certificationReadiness === 'needs-improvement' ? 'bg-yellow-500/20 border-yellow-500/30' :
          'bg-red-500/20 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-100">IFCN Compliance Status</h3>
              <p className="text-lg font-semibold capitalize">
                {complianceReport.certificationReadiness.replace('-', ' ')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-slate-100">
                {complianceReport.overallCompliance}%
              </div>
              <div className="text-slate-400 text-sm">Overall Score</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(complianceReport.principleCompliance).map(([principle, data]: [string, any]) => (
            <div key={principle} className="bg-slate-800/50 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-200 capitalize">
                  {principle.replace(/([A-Z])/g, ' $1').trim()}
                </h4>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  data.score >= 80 ? 'bg-green-500/20 text-green-300' :
                  data.score >= 60 ? 'bg-yellow-500/20 text-yellow-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {data.score}%
                </span>
              </div>
              <p className="text-slate-300 text-sm mb-2">{data.details}</p>
              {data.recommendations.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-slate-400 mb-1">Recommendations:</h5>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {data.recommendations.map((rec: string, index: number) => (
                      <li key={index}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {complianceReport.complianceWarnings.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
            <h4 className="font-semibold text-yellow-300 mb-2">⚠️ Compliance Warnings</h4>
            <ul className="text-yellow-200 text-sm space-y-1">
              {complianceReport.complianceWarnings.map((warning: string, index: number) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {complianceReport.recommendedActions.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl">
            <h4 className="font-semibold text-blue-300 mb-2">📋 Recommended Actions</h4>
            <ul className="text-blue-200 text-sm space-y-1">
              {complianceReport.recommendedActions.slice(0, 10).map((action: string, index: number) => (
                <li key={index}>• {action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderCorrectionsTab = () => {
    const ifcnService = IFCNComplianceService.getInstance();
    const corrections = ifcnService.getCorrections();

    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 p-6 rounded-xl">
          <h3 className="text-xl font-bold text-slate-100 mb-4">Correction History</h3>
          {corrections.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-2">✅</div>
              <p>No corrections have been made yet.</p>
              <p className="text-sm">This indicates consistent accuracy in fact-checking.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {corrections.map((correction) => (
                <div key={correction.id} className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">
                      {correction.timestamp.toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      correction.publiclyDisclosed ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {correction.publiclyDisclosed ? 'Public' : 'Pending Disclosure'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <strong className="text-red-300">Original:</strong>
                    <span className="ml-2 text-slate-300">{correction.originalClaim}</span>
                  </div>
                  <div className="mb-2">
                    <strong className="text-green-300">Corrected:</strong>
                    <span className="ml-2 text-slate-300">{correction.correctedVerdict}</span>
                  </div>
                  <div className="text-sm text-slate-400">
                    <strong>Reason:</strong> {correction.reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/30 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            IFCN Compliance Analysis
          </h2>
          <p className="text-slate-300">
            Industry standards compliance assessment for professional fact-checking
          </p>
        </div>

        <div className="flex bg-slate-700/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('compliance')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'compliance'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            Compliance
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'corrections'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            Corrections
          </button>
        </div>
      </div>

      {activeTab === 'compliance' && renderComplianceTab()}
      {activeTab === 'corrections' && renderCorrectionsTab()}
    </div>
  );
};

export default ComplianceDashboard;