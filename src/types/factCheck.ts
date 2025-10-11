// src/types/factCheck.ts

export interface Evidence {
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publicationDate?: string;
  credibilityScore: number;
  relevanceScore: number;
}

export interface ClaimVerificationResult {
  id: string;
  claimText: string;
  status: 'Verified' | 'Unverified' | 'Misleading' | 'Accurate' | 'Needs Context' | 'Error';
  confidenceScore: number;
  explanation: string;
  reasoning: {
    totalSources: number;
    supportingSources: number;
    conflictingSources: number;
    conclusion: string;
  };
  evidence: Evidence[];
}

export interface FactCheckReport {
  id: string;
  originalText: string;
  summary: string;
  overallAuthenticityScore: number;
  claimVerifications: ClaimVerificationResult[];
  // Keep metadata for backward compatibility with older components
  metadata?: {
    url?: string;
    publicationDate?: string;
  };
}

export interface PublishingContext {
  platform: 'Web' | 'Social Media' | 'Print';
  audience: 'General' | 'Academic' | 'Specialized';
}

export interface SearchPhaseResult {
  service: string;
  query: string;
  results: Evidence[];
}

export interface NewsSource {
    name: string;
    url: string;
}
export interface SearchParams {
    query: string;
    fromDate?: string;
    toDate?: string;
    sources?: NewsSource[];
}
export interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
    source: string;
}
