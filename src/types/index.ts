// src/types/index.ts

// Consolidate all exports into this "barrel" file.
export * from './factCheck';
export * from './enhancedFactCheck';
export * from './corrections';
export * from './advancedEditor';
export * from './apiKeys';
export * from './factDatabase';

// --- Add/Modify the following types directly in this file for clarity ---

// Add the 'link' property to EvidenceItem for SearchResults.tsx
export interface EvidenceItem {
  id: string;
  title: string;
  // Add link property
  link: string;
  url: string;
  snippet: string;
  source: string;
  score: number;
  type: 'news' | 'claim' | 'search_result';
}

export interface SourceReliabilityScore {
  score: number;
  reasoning: string;
  lastUpdated?: string;
  domain: string;
}

// Types that are not in other files and are not creating ambiguity
export type FactCheckMethod = 'TIERED' | 'ENHANCED' | 'GOOGLE_ONLY' | 'COMPREHENSIVE' | 'BING_ONLY' | 'tiered-verification' | 'TEMPORAL';
export type FactVerdict = 'Accurate' | 'Inaccurate' | 'Misleading' | 'Uncertain' | 'TRUE' | 'FALSE' | 'MIXED' | 'MOSTLY TRUE' | 'MOSTLY FALSE' | 'Comprehensive Analysis';

export interface ScoreBreakdown {
    [key: string]: {
        score: number;
        reasoning: string;
    };
}

// FactCheckReport is imported from ./factCheck, so it's available for TieredFactCheckResult
export interface TieredFactCheckResult {
    report: FactCheckReport;
    metadata: any; // Replace 'any' with a proper type if available
}

export interface Segment {
    text: string;
    color: string;
    score: number;
    temporalIssues?: any;
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    query: string;
    report: FactCheckReport;
}

export interface FactCheckMetadata {
    method: FactCheckMethod;
    processingTime: number;
    sourcesConsulted: number;
    apisUsed?: string[];
}

export interface ScoreMetric {
    name: string;
    score: number;
    reasoning: string;
}

export interface SearchEvidence {
    title: string;
    url:'string'
    snippet: string;
}

export type PublishingContext = 'NewsArticle' | 'SocialMediaPost' | 'AcademicPaper' | 'GeneralWebPage';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
