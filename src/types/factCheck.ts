// src/types/factCheck.ts

export type FactVerdict =
  | 'Accurate'
  | 'Inaccurate'
  | 'Misleading'
  | 'Unverifiable'
  | 'Partially Accurate'
  | 'Needs Context'
  | 'Satire'
  | 'Opinion'
  // Additional values used in codebase
  | 'TRUE'
  | 'FALSE'
  | 'MIXED'
  | 'UNVERIFIED'
  | 'MISLEADING'
  | 'Verified'
  | 'Unverified'
  | 'Disputed'
  | 'Retracted'
  // Additional values from components
  | 'true'
  | 'false'
  | 'mixed'
  | 'mostly-true'
  | 'mostly-false'
  | 'Error'
  | 'Analysis Incomplete'
  | 'Comprehensive Analysis'
  | 'Analysis failed due to technical error';

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
  // Additional properties used in API
  score: number;
  publishedDate?: string;
  relevance?: number;
}

// Legacy Evidence type for API compatibility
export interface EvidenceItem extends Evidence {
  credibilityScore: number;
  relevanceScore: number;
}

export interface ScoreMetric {
  name: string;
  score: number;
  weight?: number; // Made optional since many places don't provide it
  description: string;
  reasoning: string;
}

export interface ScoreBreakdown {
  // Support both naming conventions
  finalScoreFormula: string;
  final_score_formula?: string;
  metrics: ScoreMetric[];
  confidenceIntervals?: {
    lowerBound: number;
    upperBound: number;
    // Support snake_case for backward compatibility
    lower_bound?: number;
    upper_bound?: number;
  };
  confidence_intervals?: {
    lowerBound: number;
    upperBound: number;
    lower_bound?: number;
    upper_bound?: number;
  };
}

export interface ClaimVerification {
  id: string;
  claimText: string;
  status: 'Verified' | 'Unverified' | 'Disputed' | 'Retracted' | 'Error';
  confidenceScore: number;
  explanation: string;
  evidence: Evidence[];
  reasoning?: string;
  claim?: string;
  confidence?: number;
}

export interface ClaimVerificationResult extends ClaimVerification {}

export interface FactCheckMetadata {
  // Support both naming conventions
  methodUsed: string;
  method_used?: string;
  processingTimeMs: number;
  processing_time_ms?: number;
  sourcesConsulted: {
    total: number;
    highCredibility: number;
    conflicting: number;
  };
  sources_consulted?: {
    total: number;
    high_credibility?: number;
    highCredibility?: number;
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

export interface TierBreakdown {
  tier: string;
  success: boolean;
  confidence: number;
  evidence: Evidence[];
  processingTime: number;
  escalationReason?: string;
}

export interface Segment {
  text: string;
  isFact: boolean;
  score: number;
  color: 'green' | 'yellow' | 'red' | 'default' | 'orange';
  factCheckResult?: any;
}

export interface CorrectionSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  severity: 'high' | 'medium' | 'low' | 'High' | 'Medium' | 'Low';
  type: string;
  originalSegment?: string;
  suggestedCorrection?: string;
  explanation?: string;
  claimId?: string;
  evidenceUrl?: string;
}

export interface TieredFactCheckResult {
  id: string;
  originalText: string;
  // Support both naming conventions
  finalScore: number;
  final_score?: number;
  finalVerdict: FactVerdict;
  final_verdict?: FactVerdict;
  summary?: string;
  reasoning: string;
  evidence: Evidence[];
  claimVerifications?: ClaimVerification[];
  scoreBreakdown?: ScoreBreakdown;
  score_breakdown?: ScoreBreakdown;
  metadata: FactCheckMetadata;
  overallAuthenticityScore?: number;
  originalTextSegments?: Segment[];
  searchEvidence?: SearchEvidence[];
  corrections?: CorrectionSuggestion[];
}

export interface FactCheckReport extends TieredFactCheckResult {
  claimVerifications: ClaimVerification[];
  scoreBreakdown: ScoreBreakdown;
  score_breakdown?: ScoreBreakdown;
  claimBreakdown?: any;
  enhancedClaimText?: string;
  enhanced_claim_text?: string;
  extractedEntities?: any;
  timelineAnalysis?: any;
  sourceCredibilityReport?: {
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
  };
  source_credibility_report?: {
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
  };
  temporalVerification?: {
    hasTemporalClaims: boolean;
    validations: any[];
    overallTemporalScore: number;
    temporalWarnings: string[];
    timelineAnalysis?: any;
  };
  temporal_verification?: {
    hasTemporalClaims: boolean;
    validations: any[];
    overallTemporalScore: number;
    temporalWarnings: string[];
    timelineAnalysis?: any;
  };
  categoryRating?: {
    category: string;
    reasoning: string;
  };
  category_rating?: {
    category: string;
    reasoning: string;
  };
  mediaVerificationReport?: {
    hasVisualContent: boolean;
    reverseImageResults: any[];
  };
  media_verification_report?: {
    hasVisualContent: boolean;
    reverseImageResults: any[];
  };
}

export interface PartialFactCheckReport extends Partial<FactCheckReport> {
  id: string;
  originalText: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  claimText: string;
  result: TieredFactCheckResult;
  report?: FactCheckReport;
}

export type PublishingContext =
  | 'NewsArticle'
  | 'Journalism'
  | 'SocialMedia'
  | 'Academic'
  | 'General'
  | 'journalism';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  source?: string;
  link?: string;
  date?: string;
}

export interface SearchEvidence {
  query: string;
  results: SearchResult[];
}

export interface GoogleSearchResult extends SearchResult {
  url: string;
}

export interface NewsSource {
  name: string;
  url: string;
  reliability: number;
}

export interface SearchParams {
  query: string;
  fromDate?: string;
  language?: string;
  site?: string;
}

export interface AdvancedEvidence extends Evidence {
  publisher: string;
  sourceCredibility?: number;
  authorCredibility?: number;
  recency?: number;
  contradictsClaim?: boolean;
  supportsClaim?: boolean;
  factCheckVerdict?: 'true' | 'false' | 'mixed' | 'unproven' | 'unknown';
  biasScore?: number;
  lastVerified?: string;
  publishedDate?: string;
}

export type FactCheckMethod = 
  | 'google-factcheck'
  | 'web-search'
  | 'news-analysis'
  | 'ai-synthesis'
  | 'tiered-verification'
  | 'citation-augmented'
  | 'statistical-fallback'
  | 'comprehensive'
  | 'COMPREHENSIVE'
  | 'TEMPORAL'
  | 'CITATION'
  | 'tiered-verification-synthesis'
  | 'tiered-statistical-fallback';

export type ViewType = 'report' | 'methodology' | 'history';
export type TabType = 'analysis' | 'evidence' | 'editor' | 'export';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model';
  content: string;
  timestamp: number;
}

export interface SettingsConfig {
  apiKeys: {
    gemini?: string;
    serp?: string;
    webz?: string;
    factCheck?: string;
  };
  preferences: {
    theme?: 'light' | 'dark';
    language?: string;
  };
}

export interface AnalysisConfig {
  depth: 'quick' | 'standard' | 'deep';
  sources: number;
  includeImages?: boolean;
}

export interface ApiStatus {
  gemini: boolean;
  serp: boolean;
  webz: boolean;
  googleFactCheck: boolean;
}

// New interface for SERP API results
export interface SerpApiResult {
  title: string;
  link: string;
  snippet: string;
  domain?: string;
  source?: string;
  date?: string; // Added to fix error in tieredFactCheckService.ts
}
