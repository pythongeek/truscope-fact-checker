import { AdvancedEvidence } from './enhancedFactCheck';

export interface DetectedIssue {
  type: 'factual_error' | 'misleading_context' | 'outdated_info' | 'missing_context' | 'unsupported_claim';
  severity: 'low' | 'medium' | 'high' | 'critical';
  originalText: string;
  startIndex: number;
  endIndex: number;
  description: string;
  suggestedFix?: string;
  confidence: number; // 0-100
}

export interface SmartCorrection {
  id: string;
  originalStatement: string;
  correctedStatement: string;
  specificIssues: DetectedIssue[];
  correctInformation: string;
  supportingSources: AdvancedEvidence[];
  confidence: number;
  alternativePhrasings: string[];
  correctionReasoning: string;
}

export interface CorrectionAnalysis {
  totalIssues: number;
  issuesByType: Record<DetectedIssue['type'], number>;
  issuesBySeverity: Record<DetectedIssue['severity'], number>;
  overallAccuracy: number; // 0-100
  recommendedAction: 'minor_edits' | 'major_revision' | 'complete_rewrite' | 'verification_needed';
  issues: DetectedIssue[];
}

export interface CorrectionSuggestion {
    id: string; // Unique ID for the suggestion
    originalSegment: string; // The specific text snippet to be replaced
    suggestedCorrection: string; // The proposed new text
    explanation: string; // Why the change is being suggested
    claimId: string; // The ID of the claim this correction relates to
    evidenceUrl?: string; // A direct link to the most compelling piece of evidence
    severity: 'High' | 'Medium' | 'Low'; // e.g., Factual error vs. Minor clarification
}
