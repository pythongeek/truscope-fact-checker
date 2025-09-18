import React from 'react';
// FIX: Updated import path for FactCheckReport.
import { FactCheckReport } from '../types/factCheck';
import ScoreBreakdown from './ScoreBreakdown';
import EvidenceTable from './EvidenceTable';
import MethodologyView from './MethodologyView';
import SearchResults from './SearchResults';

interface ReportViewProps {
    report: FactCheckReport;
    activeTab: 'Evidence' | 'Breakdown' | 'Methodology' | 'Search Results';
}

const ReportView: React.FC<ReportViewProps> = ({ report, activeTab }) => {
    switch (activeTab) {
        case 'Evidence':
            return <EvidenceTable evidence={report.evidence} />;
        case 'Breakdown':
            return <ScoreBreakdown breakdown={report.score_breakdown} />;
        case 'Methodology':
            return <MethodologyView metadata={report.metadata} />;
        case 'Search Results':
            return <SearchResults searchEvidence={report.searchEvidence} />;
        default:
            return null;
    }
};

export default ReportView;