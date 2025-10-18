import { EvidenceItem } from './factCheck';

// File: src/types/enhancedFactCheck.ts
export interface AdvancedEvidence extends EvidenceItem {
  sourceCredibility: number; // 0-100
  authorCredibility: number; // 0-100
  recency: number; // Days since publication
  relevanceScore: number; // 0-100
  contradictsClaim: boolean;
  supportsClaim: boolean;
  factCheckVerdict: 'true' | 'false' | 'mixed' | 'unproven' | 'unknown';
  biasScore: number; // -100 to 100 (negative = left bias, positive = right bias)
  publishedDate?: string;
  lastVerified: string;
}

export interface MultiSourceResult {
  // --- CHANGE: Added 'news-api' to the list of valid sources ---
  source: 'politifact' | 'snopes' | 'factcheck' | 'reuters' | 'ap' | 'pubmed' | 'scholar' | 'wikipedia' | 'arxiv' | 'googleNews' | 'news-api';
  available: boolean;
  results: AdvancedEvidence[];
  error?: string;
  searchQuery: string;
}

export interface SourceReliabilityScore {
  domain: string;
  reliabilityScore: number; // 0-100
  category: 'news' | 'academic' | 'government' | 'fact_check' | 'social' | 'blog';
  biasRating: 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'unknown';
  lastUpdated: string;
  verificationCount: number;
}

export interface SourceCredibilityData {
  domain: string;
  credibilityScore: number;
  biasRating: string;
  factualReporting: string;
  category: 'academic' | 'news' | 'government' | 'social' | 'blog' | 'ngo';
  lastUpdated: Date;
  verificationStatus: 'verified' | 'flagged' | 'unverified';
  notes?: string;
}

export interface SourceCredibilityReport {
  overallScore: number;
  highCredibilitySources: number;
  flaggedSources: number;
  biasWarnings: string[];
  credibilityBreakdown: {
    academic: number;
    news: number;
    government: number;
    social: number;
  };
}

export interface MediaVerificationReport {
  hasVisualContent: boolean;
  reverseImageResults: any[];
}

export interface TimelineEvent {
    date: string;
    description: string;
    source: string;
}

export interface TemporalValidation {
    isValid: boolean;
    reasoning: string;
    dateType: 'past' | 'present' | 'future' | 'near_future' | 'far_future';
}

export interface CategoryRating {
    category: string;
    reasoning: string;
}

export interface TemporalAnalysis {
    events: TimelineEvent[];
    consistencyScore: number;
    warnings: string[];
}
