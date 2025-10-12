// src/types/factCheck.ts

export type FactVerdict =
  | 'Accurate'
  | 'Inaccurate'
  | 'Misleading'
  | 'Unverifiable'
  | 'Partially Accurate'
  | 'Needs Context'
  | 'Satire'
  | 'Opinion';

export interface Source {
  name: string;
  url: string;
  credibility: {
    rating: 'High' | 'Medium' | 'Low' | 'Unknown';
    classification: string;
    warnings: string[];
  };
}

export interface Evidence {
  id: string;
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publicationDate?: string;
  credibilityScore: number;
  relevanceScore: number;
  type: 'claim' | 'news' | 'search_result' | 'official_source';
  source: Source;
  quote?: string;
}

export interface ScoreMetric {
  name: string;
  score: number;
  weight: number;
  description: string;
  reasoning: string;
}

export interface ScoreBreakdown {
  finalScoreFormula: string;
  metrics: ScoreMetric[];
  confidenceIntervals?: {
    lowerBound: number;
    upperBound: number;
  };
}

export interface ClaimVerification {
  id: string;
  claimText: string;
  status: 'Verified' | 'Unverified' | 'Disputed' | 'Retracted';
  confidenceScore: number;
  explanation: string;
  evidence: Evidence[];
  reasoning?: string;
}

export interface FactCheckMetadata {
  methodUsed: string;
  processingTimeMs: number;
  sourcesConsulted: {
    total: number;
    highCredibility: number;
    conflicting: number;
  };
  apisUsed?: string[];
  warnings: string[];
  pipelineMetadata?: Record<string, any>;
  tierBreakdown?: Array<{
    tier: string;
    success: boolean;
    confidence: number;
    processingTimeMs: number;
    evidenceCount: number;
  }>;
}

export interface Segment {
  text: string;
  isFact: boolean;
  score: number;
  color: 'green' | 'yellow' | 'red' | 'default';
}

export interface TieredFactCheckResult {
  id: string;
  originalText: string;
  finalScore: number;
  finalVerdict: FactVerdict;
  summary: string;
  reasoning: string;
  evidence: Evidence[];
  claimVerifications: ClaimVerification[];
  scoreBreakdown: ScoreBreakdown;
  metadata: FactCheckMetadata;
  overallAuthenticityScore: number;
  originalTextSegments?: Segment[];
}

export interface FactCheckReport extends TieredFactCheckResult {}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  claimText: string;
  result: TieredFactCheckResult;
}

export type PublishingContext =
  | 'NewsArticle'
  | 'Journalism'
  | 'SocialMedia'
  | 'Academic'
  | 'General';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchEvidence {
  query: string;
  results: SearchResult[];
}
