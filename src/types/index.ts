// src/types/index.ts

export * from './factCheck';
export * from './corrections';
export * from './apiKeys';
export * from './advancedEditor';
export * from './factDatabase';
export * from './enhancedFactCheck';


export type FactVerdict = 'Accurate' | 'Inaccurate' | 'Misleading' | 'Uncertain' | 'TRUE' | 'FALSE' | 'MIXED' | 'MOSTLY TRUE' | 'MOSTLY FALSE';

export interface EvidenceItem {
    id: string;
    url: string;
    title: string;
    snippet: string;
    source: string;
    publisher: string;
    quote: string;
    score: number;
    type: string;
    publishedDate?: string;
}

export interface ScoreBreakdown {
    [key: string]: {
        score: number;
        reasoning: string;
    };
}

export interface ScoreMetric {
  name: string;
  score: number;
  reasoning: string;
  // Add missing 'description' property
  description: string;
}

export interface SearchEvidence {
  source: string;
  // Add missing 'query' and 'results' properties
  query: string;
  results: EvidenceItem[];
}

// Make sure PublishingContext is defined and exported
export type PublishingContext = 'NewsArticle' | 'SocialMediaPost' | 'ResearchPaper' | 'Other';

export * from './enums';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
