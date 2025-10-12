// src/types/index.ts

// --- Core API and Configuration ---

export interface ApiKeys {
  gemini?: string;
  geminiModel?: string;
  factCheck?: string;
  search?: string;
  searchId?: string;
  newsdata?: string;
  serp?: string;
}

export interface SettingsConfig {
  apiKeys: ApiKeys;
  preferences?: {
    theme?: 'light' | 'dark';
    autoSave?: boolean;
    citationStyle?: 'ap' | 'apa' | 'chicago';
    language?: string;
  };
}

export interface AnalysisConfig {
  text: string;
  publishingContext: string;
  config: ApiKeys;
  options?: {
    deepAnalysis?: boolean;
    includeSuggestions?: boolean;
    minimumSources?: number;
  };
}

// --- Fact-Checking Core Types ---

export type FactVerdict = 'TRUE' | 'FALSE' | 'MIXED' | 'UNVERIFIED' | 'MISLEADING';

export interface Evidence {
  quote: string;
  publisher: string;
  url?: string;
  score: number;
  publishedDate?: string;
  relevance?: number;
  tier?: string;
  snippet?: string;
  credibilityScore?: number;
}

export interface ClaimVerification {
  claim: string;
  status: FactVerdict;
  confidence: number;
  evidence: Evidence[];
  explanation?: string;
}

export interface ScoreMetric {
  name: string;
  score: number;
  explanation: string;
  weight: number;
}

export interface ScoreBreakdown {
  clarity: ScoreMetric;
  bias: ScoreMetric;
  source_reliability: ScoreMetric;
  evidence_support: ScoreMetric;
}

export interface FactCheckMetadata {
  processing_time_ms: number;
  method_used?: string;
  model?: string;
  timestamp?: string;
  version?: string;
  tier_breakdown?: TierBreakdown[];
  apisUsed?: string[];
  sources_consulted?: {
    total: number;
    high_credibility: number;
    conflicting: number;
  };
  warnings?: string[];
}

export interface FactCheckReport {
  id: string;
  originalText: string;
  final_score: number;
  final_verdict: FactVerdict;
  reasoning: string;
  evidence: Evidence[];
  metadata?: FactCheckMetadata;
  claimVerifications?: ClaimVerification[];
  overallAuthenticityScore?: number;
  suggestions?: string[];
  warnings?: string[];
  timestamp?: string;
  score_breakdown?: ScoreBreakdown;
  searchEvidence?: SearchEvidence[];
  originalTextSegments?: Segment[];
  summary?: string;
  category_rating?: any; // Define more strictly if possible
  media_verification_report?: any; // Define more strictly if possible
  enhanced_claim_text?: string;
  source_credibility_report?: any;
  temporal_verification?: any;
}

// --- Tiered Fact-Checking & Enhanced Results ---

export interface TierBreakdown {
  tier: string;
  success: boolean;
  confidence: number;
  evidence?: Evidence[];
  processingTime: number;
  escalationReason?: string;
}

export interface TieredFactCheckResult {
  report: FactCheckReport;
  tierBreakdown: TierBreakdown[];
  isComplete: boolean;
}

// --- Editorial and Auto-Correction Types ---

export interface CorrectionSuggestion {
  originalText: string;
  suggestedText: string;
  explanation: string;
  confidence: number;
  type: 'grammar' | 'clarity' | 'factual' | 'style';
}

export interface EditorResult {
  correctedText: string;
  changesApplied: Array<{
    description: string;
    original?: string;
    corrected?: string;
    type?: string;
  }>;
  summary?: string;
  improvementScore?: number;
}

export type EditorMode = 'basic' | 'enhanced' | 'conservative' | 'aggressive';

// --- Text Analysis and Segmentation ---

export interface Segment {
  text: string;
  isFact: boolean;
  factCheckResult?: ClaimVerification;
}

// --- Data, History, and Storage ---

export interface HistoryEntry {
  id: string;
  timestamp: string;
  query: string;
  result: TieredFactCheckResult;
  context?: PublishingContext;
}

export interface FactDatabase {
  [key: string]: {
    claim: string;
    verdict: FactVerdict;
    timestamp: string;
    source: string;
  };
}

// --- UI & Component-Specific Types ---

export type ViewType = 'checker' | 'history' | 'trending' | 'compliance';
export type TabType = 'analyze' | 'report' | 'edit' | 'methodology';
export type ApiStatus = 'checking' | 'available' | 'unavailable';

export interface PublishingContext {
  id: string;
  label: string;
  description: string;
  guidelines: string[];
  icon: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SearchEvidence {
  url: string;
  title: string;
  snippet: string;
}

export interface SourceReliabilityScore {
  source: string;
  score: number;
  reasoning: string;
}
