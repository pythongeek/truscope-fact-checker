// src/types/index.ts
/**
 * @file This file serves as a barrel, re-exporting all type definitions from other
 * files in this directory. This provides a single, consistent import path for all
 * types throughout the application and ensures a single source of truth.
 */

// Note: All type definitions are now sourced from their specific files 
// (e.g., factCheck.ts, apiKeys.ts) to avoid conflicts and improve organization.

// Types from src/types/apiKeys.ts
export type { 
  ApiKeys, 
  SettingsConfig, 
  AnalysisConfig, 
  ApiStatus 
} from './apiKeys';

// Types from src/types/advancedEditor.ts
export type { 
  CorrectionSuggestion, 
  EditorResult, 
  EditorMode 
} from './advancedEditor';

// Types from src/types/factCheck.ts - The primary source of truth for core types.
export type {
  FactVerdict,
  Source,
  Evidence,
  EvidenceItem, // Legacy alias for Evidence
  ScoreMetric,
  ScoreBreakdown,
  ClaimVerification,
  ClaimVerificationResult, // Legacy alias for ClaimVerification
  FactCheckMetadata,
  TierBreakdown, // ADDED - Used in api/fact-check.ts
  Segment,
  TieredFactCheckResult,
  FactCheckReport,
  PartialFactCheckReport, // ADDED - Used in helpers.ts
  HistoryEntry,
  PublishingContext,
  SearchResult,
  SearchEvidence,
  GoogleSearchResult, // ADDED - Used in webSearch.ts
  NewsSource, // ADDED - Used in webzNewsService.ts
  SearchParams, // ADDED - Used in webzNewsService.ts
  AdvancedEvidence, // ADDED - Used in intelligentCorrector.ts and multiSourceVerifier.ts
  FactCheckMethod, // ADDED - Used in multiple service files
  ViewType, // MOVED from enhancedFactCheck.ts - now in factCheck.ts
  TabType, // MOVED from enhancedFactCheck.ts - now in factCheck.ts
  ChatMessage, // MOVED from enhancedFactCheck.ts - now in factCheck.ts
} from './factCheck';

// Types from src/types/factDatabase.ts
export type { 
  FactDatabase 
} from './factDatabase';

// Types from src/types/enhancedFactCheck.ts and other UI/component-specific files.
export type {
  SourceReliabilityScore,
  MultiSourceResult,
  SourceCredibilityData,
  SourceCredibilityReport,
  MediaVerificationReport,
  TimelineEvent,
  TemporalValidation,
  CategoryRating,
  TemporalAnalysis
} from './enhancedFactCheck';

// Re-export helper functions
export { 
  completeFactCheckReport, 
  createErrorReport, 
  createDefaultEvidence 
} from './helpers';

// Re-export type guards
export { 
  isFactCheckReport, 
  getReport 
} from './guards';
