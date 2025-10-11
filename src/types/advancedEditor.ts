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

// Ensure CorrectionSuggestion is defined and exported
export interface CorrectionSuggestion {
  originalText: string;
  correctedText: string;
  explanation: string;
  confidence: number;
}