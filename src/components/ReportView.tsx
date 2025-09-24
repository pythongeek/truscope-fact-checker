import React from 'react';
// FIX: Updated import path for FactCheckReport.
import { FactCheckReport } from '../types';
import ScoreBreakdown from './ScoreBreakdown';
import EvidenceTable from './EvidenceTable';
import MethodologyView from './MethodologyView';
import SearchResults from './SearchResults';
import ColorCodedText from './ColorCodedText';
import EnhancedClaimAnalysis from './EnhancedClaimAnalysis';

interface ReportViewProps {
    report: FactCheckReport;
    activeTab: 'Overview' | 'Evidence' | 'Breakdown' | 'Methodology' | 'Search Results' | 'Original Text Analysis';
}

const ReportView: React.FC<ReportViewProps> = ({ report, activeTab }) => {
    switch (activeTab) {
        case 'Overview':
            return (
                <div className="space-y-6">
                  <ScoreBreakdown breakdown={report.score_breakdown} reasoning={report.reasoning} />
                  {/* Only show Enhanced Claim Analysis if enhanced_claim_text exists and is not empty */}
                  {report.enhanced_claim_text && report.enhanced_claim_text.trim() && (
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-semibold text-slate-100 mb-3">Enhanced Claim Analysis</h3>
                      <EnhancedClaimAnalysis text={report.enhanced_claim_text} />
                    </div>
                  )}
                </div>
              );
        case 'Evidence':
            return <EvidenceTable evidence={report.evidence} />;
        case 'Breakdown':
            return <ScoreBreakdown breakdown={report.score_breakdown} reasoning={report.reasoning} />;
        case 'Methodology':
            return <MethodologyView metadata={report.metadata} />;
        case 'Search Results':
            return <SearchResults searchEvidence={report.searchEvidence} />;
        case 'Original Text Analysis':
            return <ColorCodedText segments={report.originalTextSegments} />;
        default:
            return null;
    }
};

export default ReportView;
