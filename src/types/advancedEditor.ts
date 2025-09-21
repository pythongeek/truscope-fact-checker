export type EditorMode =
  | 'quick-fix'
  | 'enhanced'
  | 'complete-rewrite'
  | 'seo-optimized'
  | 'academic'
  | 'expansion';

export interface EditorConfig {
  id: EditorMode;
  name: string;
  description: string;
  prompt: string;
  expectedOutputLength: 'preserve' | 'expand' | 'comprehensive';
  processingTime: 'fast' | 'medium' | 'slow';
  costTier: 'low' | 'medium' | 'high';
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

export interface ContentChange {
  type: 'addition' | 'deletion' | 'modification' | 'restructure';
  originalPhrase: string;
  newPhrase?: string;
  reason: string;
  confidence: number;
  position: { start: number; end: number };
}
