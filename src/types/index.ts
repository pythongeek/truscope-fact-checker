export type {
  FactCheckReport,
  Evidence,
  ClaimVerificationResult,
  ScoreBreakdown,
  FactCheckMetadata,
  EvidenceItem,
  SourceCredibilityReport,
  TemporalVerification,
  MediaVerificationReport,
  CategoryRating,
  SearchEvidence,
  TieredFactCheckResult,
  HistoryEntry,
  PublishingContext,
  SearchPhaseResult,
  NewsSource,
  SearchParams,
  GoogleSearchResult,
} from './factCheck';
export type {
  AdvancedEvidence,
  MultiSourceResult,
  SourceReliabilityScore,
  SourceCredibilityData,
} from './enhancedFactCheck';
export type {
  DetectedIssue,
  SmartCorrection,
  CorrectionAnalysis,
  CorrectionSuggestion,
} from './corrections';
export type {
  FactCheckSegment,
  FactCheckAnalysis,
  EditorMode,
  ContentChange,
  EditorResult,
} from './advancedEditor';
export type { ApiKeys, ApiKeyField, ApiKeyConfig } from './apiKeys';
export type {
  FactDatabase,
  VerifiedSource,
  FactMetadata,
  VerificationInfo,
  TrendingInfo,
  VerificationEvent,
  PlatformMention,
} from './factDatabase';

// Types that are not in other files and are not creating ambiguity
export type FactCheckMethod = 'COMPREHENSIVE' | 'TEMPORAL' | 'CITATION' | 'tiered-verification' | 'comprehensive';
export type FactVerdict = 'Accurate' | 'Inaccurate' | 'Misleading' | 'Uncertain' | 'TRUE' | 'FALSE' | 'MIXED' | 'MOSTLY TRUE' | 'MOSTLY FALSE' | 'Comprehensive Analysis' | 'true' | 'mostly-true' | 'mixed' | 'mostly-false' | 'false' | 'unverified';

export interface Segment {
    text: string;
    color: string;
    score: number;
    temporalIssues?: any;
}

export interface ScoreMetric {
    name: string;
    score: number;
    reasoning: string;
    description: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
