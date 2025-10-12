// src/types/index.ts
/**
 * @file This file serves as a barrel, re-exporting all type definitions from other
 * files in this directory. This provides a single, consistent import path for all
 * types throughout the application and ensures a single source of truth.
 */

// Note: All type definitions are now sourced from their specific files 
// (e.g., factCheck.ts, apiKeys.ts) to avoid conflicts and improve organization.

// Types from src/types/apiKeys.ts
export type { ApiKeys, SettingsConfig, AnalysisConfig, ApiStatus } from './apiKeys';

// Types from src/types/advancedEditor.ts
export type { CorrectionSuggestion, EditorResult, EditorMode } from './advancedEditor';

// Types from src/types/factCheck.ts - The primary source of truth for core types.
export type {
  FactVerdict,
  Source,
  Evidence, // Note: 'EvidenceItem' is now 'Evidence'.
  ScoreMetric,
  ScoreBreakdown,
  ClaimVerification,
  FactCheckMetadata, // Note: 'FactCheckMethod' has been replaced by this.
  Segment,
  TieredFactCheckResult,
  FactCheckReport,
  HistoryEntry,
  PublishingContext,
  SearchResult,
  SearchEvidence,
} from './factCheck';

// Types from src/types/factDatabase.ts
export type { FactDatabase } from './factDatabase';

// Types from src/types/enhancedFactCheck.ts and other UI/component-specific files.
export type {
  ViewType,
  TabType,
  ChatMessage,
  SourceReliabilityScore
} from './enhancedFactCheck';
