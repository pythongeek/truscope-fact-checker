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
  
  // Primary properties (used in AutoEditorTab)
  originalText: string; // The specific text snippet to be replaced
  suggestedText: string; // The proposed new text
  
  // Alias properties for backward compatibility
  originalSegment?: string; // Alias for originalText
  suggestedCorrection?: string; // Alias for suggestedText
  
  // Additional properties
  explanation?: string; // Why the change is being suggested (also mapped to 'reason')
  reason?: string; // Alias for explanation
  claimId?: string; // The ID of the claim this correction relates to
  evidenceUrl?: string; // A direct link to the most compelling piece of evidence
  severity?: 'High' | 'Medium' | 'Low' | 'high' | 'medium' | 'low'; // e.g., Factual error vs. Minor clarification
  type?: string; // Type of correction
}
