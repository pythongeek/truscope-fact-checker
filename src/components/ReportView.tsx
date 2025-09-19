import React from 'react';
// FIX: Updated import path for FactCheckReport.
import { FactCheckReport } from '../types/factCheck';
import ScoreBreakdown from './ScoreBreakdown';
import EvidenceTable from './EvidenceTable';
import MethodologyView from './MethodologyView';
import SearchResults from './SearchResults';
import ColorCodedText from './ColorCodedText.tsx';

interface ReportViewProps {
    report: FactCheckReport;
    activeTab: 'Evidence' | 'Breakdown' | 'Methodology' | 'Search Results' | 'Original Text Analysis';
}

const ReportView: React.FC<ReportViewProps> = ({ report, activeTab }) => {
    switch (activeTab) {
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