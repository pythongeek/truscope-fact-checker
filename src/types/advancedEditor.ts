import { FactCheckReport } from './factCheck';

export interface FactCheckSegment {
  text: string;
  score: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
  startIndex: number;
  endIndex: number;
  reason: string;
}

export interface FactCheckAnalysis {
  segments: FactCheckSegment[];
  overallScore: number;
  verdict: string;
  timestamp: string;
  corrections: Array<{
    original: string;
    corrected: string;
    reason: string;
    confidence: number;
  }>;
  originalReport: FactCheckReport;
}

export type EditorMode =
  | 'quick-fix'
  | 'enhanced'
  | 'complete-rewrite'
  | 'seo-optimized'
  | 'academic'
  | 'expansion';

export interface ContentChange {
  type: 'modification' | 'addition' | 'deletion';
  originalPhrase: string;
  newPhrase: string;
  reason: string;
  confidence: number;
  position: { start: number; end: number };
}

export interface EditorResult {
  mode: EditorMode;
  originalText: string;
  editedText: string;
  changesApplied: ContentChange[];
  improvementScore: number;
  processingTime: number;
  confidence: number;
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
