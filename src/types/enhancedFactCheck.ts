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
  source: 'politifact' | 'snopes' | 'factcheck' | 'reuters' | 'ap' | 'pubmed' | 'scholar' | 'wikipedia' | 'arxiv' | 'googleNews';
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
