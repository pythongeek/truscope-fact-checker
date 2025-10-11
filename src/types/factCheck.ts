// src/types/factCheck.ts

interface Evidence {
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publicationDate?: string;
  credibilityScore: number;
  relevanceScore: number;
}

interface ClaimVerificationResult {
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

interface FactCheckReport {
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

interface PublishingContext {
  platform: 'Web' | 'Social Media' | 'Print';
  audience: 'General' | 'Academic' | 'Specialized';
}

interface SearchPhaseResult {
  service: string;
  query: string;
  results: Evidence[];
}

interface NewsSource {
    name: string;
    url: string;
}
interface SearchParams {
    query: string;
    fromDate?: string;
    toDate?: string;
    sources?: NewsSource[];
}
interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
    source: string;
}
