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
  | 'Analysis Incomplete'; // Added for helpers.ts

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
  // Optional property from EnhancedClaimAnalysis
  relevance?: number;
}

// Legacy Evidence type for API compatibility
export interface EvidenceItem extends Evidence {
  // Ensure all required properties from Evidence are present
  credibilityScore: number;
  relevanceScore: number;
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
  status: 'Verified' | 'Unverified' | 'Disputed' | 'Retracted' | 'Error';
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
  factCheckResult?: any; // For backward compatibility
}

export interface CorrectionSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  severity: 'high' | 'medium' | 'low' | 'High' | 'Medium' | 'Low';
  type: string;
  // Additional properties from advancedEditor.ts
  originalSegment?: string;
  suggestedCorrection?: string;
  explanation?: string;
  claimId?: string;
  evidenceUrl?: string;
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
  // Additional optional properties used in various components
  claimBreakdown?: any;
  enhancedClaimText?: string; // camelCase version
  enhanced_claim_text?: string; // snake_case for backward compatibility
  extractedEntities?: any; // Added for EnhancedFactCheckService.ts
  timelineAnalysis?: any; // Added for EnhancedFactCheckService.ts
  sourceCredibilityReport?: { // camelCase version
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
  source_credibility_report?: { // snake_case for backward compatibility
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
  temporalVerification?: { // camelCase version
    hasTemporalClaims: boolean;
    validations: any[];
    overallTemporalScore: number;
    temporalWarnings: string[];
  };
  temporal_verification?: { // snake_case for backward compatibility
    hasTemporalClaims: boolean;
    validations: any[];
    overallTemporalScore: number;
    temporalWarnings: string[];
  };
  categoryRating?: { // camelCase version
    category: string;
    reasoning: string;
  };
  category_rating?: { // snake_case for backward compatibility
    category: string;
    reasoning: string;
  };
  mediaVerificationReport?: { // camelCase version
    hasVisualContent: boolean;
    reverseImageResults: any[];
  };
  media_verification_report?: { // snake_case for backward compatibility
    hasVisualContent: boolean;
    reverseImageResults: any[];
  };
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
  report?: FactCheckReport; // Additional property from HistoryView
}

export type PublishingContext =
  | 'NewsArticle'
  | 'Journalism'
  | 'SocialMedia'
  | 'Academic'
  | 'General'
  | 'journalism'; // lowercase variant

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
  // Ensure url is required for GoogleSearchResult
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

// Advanced Evidence type for more complex scenarios
export interface AdvancedEvidence extends Evidence {
  // All properties from Evidence are inherited
  // Additional properties from enhancedFactCheck.ts
  publisher: string; // Make required instead of optional to satisfy Evidence
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

// Method capabilities
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
  | 'CITATION'; // Added for methodCapabilities.ts

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
