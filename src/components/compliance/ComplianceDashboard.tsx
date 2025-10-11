// src/components/compliance/ComplianceDashboard.tsx
import React from 'react';
import { TieredFactCheckResult } from '@/types';
import { EnhancedFactCheckReport } from '../EnhancedFactCheckReport';

interface ComplianceDashboardProps {
  report: TieredFactCheckResult;
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ report }) => {
  return (
    <div className="compliance-dashboard">
      <h2>Compliance Overview</h2>
      <p>Overall Score: {report.overallAuthenticityScore}</p>
      <EnhancedFactCheckReport report={report} />
    </div>
  );
};

export default ComplianceDashboard;
