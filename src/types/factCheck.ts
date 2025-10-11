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


export interface ScoreBreakdown {
  final_score_formula: string;
  metrics: {
    name: string;
    score: number;
    description: string;
  }[];
  confidence_intervals: {
    lower_bound: number;
    upper_bound: number;
  };
}

export interface FactCheckMetadata {
  method_used: any;
  processing_time_ms: number;
  sources_consulted: {
    total: number;
    high_credibility: number;
    conflicting: number;
  };
  apisUsed?: string[];
  warnings: string[];
}
export interface EvidenceItem {
  id: string;
  publisher: string;
  url: string;
  quote: string;
  score: number;
  type: 'claim' | 'news' | 'search_result';
  title: string;
  snippet: string;
  source: {
    name: string;
    url: string;
    credibility: {
      rating: 'High' | 'Medium' | 'Low';
      classification: string;
      warnings: string[];
    };
  };
  publishedDate?: string;
  relevanceScore?: number;
}
export interface SourceCredibilityReport {}
export interface TemporalVerification {}
export interface MediaVerificationReport {}
export interface CategoryRating {}
export interface SearchEvidence {
  query: string;
  results: {
    title: string;
    url: string;
    snippet: string;
  }[];
}


export interface FactCheckReport {
  id: string;
  originalText: string;
  final_score: number;
  final_verdict: string;
  reasoning: string;
  evidence: EvidenceItem[];
  enhanced_claim_text?: string;
  originalTextSegments?: Array<{
    text: string;
    score: number;
    color: 'green' | 'yellow' | 'red';
  }>;
  source_credibility_report?: SourceCredibilityReport;
  temporal_verification?: TemporalVerification;
  media_verification_report?: MediaVerificationReport;
  category_rating?: CategoryRating;
  searchEvidence?: SearchEvidence;
  score_breakdown: ScoreBreakdown;
  metadata: FactCheckMetadata;
  claimVerifications?: ClaimVerificationResult[];
  summary?: string;
  overallAuthenticityScore?: number;
  claimBreakdown?: Array<{
    id: string;
    text: string;
    type: string;
    verifiability: string;
    priority: number;
  }>;
  extractedEntities?: Array<{
    name: string;
    type: string;
    relevance: number;
  }>;
  searchPhases?: any;
}

export interface TieredFactCheckResult {
  report: FactCheckReport;
  metadata: {
    tier_breakdown?: Array<{
      tier: string;
      success: boolean;
      confidence: number;
      processing_time_ms: number;
      evidence_count: number;
    }>;
    [key: string]: any;
  };
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    query: string;
    report: FactCheckReport;
    claimText: string;
}

export type PublishingContext =
  | 'NewsArticle'
  | 'journalism'
  | 'social-media'
  | 'academic';

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
