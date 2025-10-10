// src/types/index.ts

export * from './factCheck';
export * from './corrections';
export * from './apiKeys';
export * from './advancedEditor';
export * from './factDatabase';

// From the old types.ts file, now integrated here
export type FactCheckMethod = 'TIERED' | 'ENHANCED' | 'GOOGLE_ONLY';
export type EditorMode = 'neutral' | 'constructive' | 'critical';
export type FactVerdict = 'Accurate' | 'Inaccurate' | 'Misleading' | 'Uncertain';

export interface EvidenceItem {
    url: string;
    title: string;
    snippet: string;
    source: string;
}

export interface SourceReliabilityScore {
    source: string;
    score: number;
    justification: string;
}

// For the new AI Assistant
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
