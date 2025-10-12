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
  | 'Retracted';

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
  score: number; // Alias for credibilityScore for backward compatibility
  publishedDate?: string; // Alias for publicationDate
}

// Legacy Evidence type for API compatibility
export interface EvidenceItem extends Evidence {}

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
  // Additional properties used in components
  claim?: string;
  confidence?: number;
}

// Legacy type alias
export interface ClaimVerificationResult extends ClaimVerification {}

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
  tierBreakdown?: TierBreakdown[];
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
  color: 'green' | 'yellow' | 'red' | 'default';
  factCheckResult?: any; // For backward compatibility
}

export interface CorrectionSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  type: string;
}

export interface TieredFactCheckResult {
  id: string;
  originalText: string;
  finalScore: number;
  finalVerdict: FactVerdict;
  summary?: string;
  reasoning: string;
  evidence: Evidence[];
  claimVerifications?: ClaimVerification[];
  scoreBreakdown?: ScoreBreakdown;
  metadata: FactCheckMetadata;
  overallAuthenticityScore?: number;
  originalTextSegments?: Segment[];
  searchEvidence?: SearchEvidence[];
  corrections?: CorrectionSuggestion[];
}

export interface FactCheckReport extends TieredFactCheckResult {
  // Ensure all required properties are present
  claimVerifications: ClaimVerification[];
  scoreBreakdown: ScoreBreakdown;
}

// Partial report for intermediate processing
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
  domain?: string;
  source?: string;
  link?: string;
  date?: string;
}

export interface SearchEvidence {
  query: string;
  results: SearchResult[];
}

export interface GoogleSearchResult extends SearchResult {}

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

// Advanced Evidence type for more complex scenarios
export interface AdvancedEvidence extends Evidence {
  publisher?: string;
  quote?: string;
  id?: string;
}

// Method capabilities
export type FactCheckMethod = 
  | 'google-factcheck'
  | 'web-search'
  | 'news-analysis'
  | 'ai-synthesis'
  | 'tiered-verification'
  | 'citation-augmented'
  | 'statistical-fallback';

// View and UI types
export type ViewType = 'report' | 'methodology' | 'history';
export type TabType = 'analysis' | 'evidence' | 'editor' | 'export';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Settings and configuration
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
