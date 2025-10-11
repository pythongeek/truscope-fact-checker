import { ClaimVerificationResult, FactCheckReport, Evidence } from './factCheck';

// File: src/types/enhancedFactCheck.ts

// Add the missing type exports. Define their structure based on usage in services.
export interface SourceCredibilityData {
  rating: string;
  classification: string;
  warnings: string[];
}

export interface SourceCredibilityReport {
  [key: string]: SourceCredibilityData;
}

export interface MediaVerificationReport {
  isAuthentic: boolean;
  details: string;
}

export interface TimelineEvent {
  date: string;
  description: string;
}

export interface TemporalValidation {
  isValid: boolean;
  reasoning: string;
}

export interface TemporalAnalysis {
  timeline: TimelineEvent[];
  validation: TemporalValidation;
}

export interface CategoryRating {
  [category: string]: {
    score: number;
    reasoning: string;
  };
}

// Update AdvancedEvidence to include missing properties
export interface AdvancedEvidence {
  id: string; // Add missing id
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publishedDate?: string;
  relevanceScore: number;
  credibilityScore: number; // Add missing credibilityScore
  biasScore: number;
  factCheckVerdict: 'supporting' | 'refuting' | 'neutral' | 'unknown';
  // Add quote for intelligentCorrector service
  quote?: string;
}

// Ensure TieredFactCheckResult is well-defined
export interface TieredFactCheckResult {
  id: string;
  originalText: string;
  summary: string;
  overallAuthenticityScore: number;
  claimVerifications: ClaimVerificationResult[];
  report: FactCheckReport; // Add the missing 'report' property
  metadata: any;
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
