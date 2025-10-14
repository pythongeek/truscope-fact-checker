import React from 'react';
import { FactCheckReport, ScoreBreakdown as ScoreBreakdownType } from '@/types';
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
    // FIX: Correctly handle the possibility of score_breakdown being undefined.
    // Providing an empty object as a default is a cleaner way to satisfy the type contract.
    const scoreBreakdown: ScoreBreakdownType = report.score_breakdown ?? {};

    switch (activeTab) {
        case 'Overview':
            return (
                <div className="space-y-6">
                    <ScoreBreakdown breakdown={scoreBreakdown} reasoning={report.reasoning ?? ''} />
                    {/* Only show Enhanced Claim Analysis if claimVerifications exists and is not empty */}
                    {report.claimVerifications && report.claimVerifications.length > 0 && (
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-100 mb-3">Enhanced Claim Analysis</h3>
                            <EnhancedClaimAnalysis claim={report.claimVerifications[0]} />
                        </div>
                    )}
                </div>
            );
        case 'Evidence':
            // FIX: Pass an empty array if evidence is null or undefined to prevent crashes.
            return <EvidenceTable evidence={report.evidence ?? []} />;
        case 'Breakdown':
            return <ScoreBreakdown breakdown={scoreBreakdown} reasoning={report.reasoning ?? ''} />;
        case 'Methodology':
            // FIX: Ensure metadata is not null before passing to MethodologyView
            return report.metadata ? <MethodologyView metadata={report.metadata} /> : <div className="text-slate-400">No methodology data available.</div>;
        case 'Search Results':
            return (
                <div className="space-y-4">
                    {report.searchEvidence && report.searchEvidence.length > 0 ? (
                        report.searchEvidence.map((evidence, index) => (
                            <SearchResults key={index} searchEvidence={evidence} />
                        ))
                    ) : (
                        <div className="text-slate-400">No search results available.</div>
                    )}
                </div>
            );
        case 'Original Text Analysis':
             // FIX: Pass an empty array if originalTextSegments is null or undefined.
            return <ColorCodedText segments={report.originalTextSegments ?? []} />;
        default:
            return null;
    }
};

export default ReportView;
