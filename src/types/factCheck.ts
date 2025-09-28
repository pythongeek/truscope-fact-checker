import { GoogleSearchResult } from '../types';

// NEW - Replace with streamlined methods
export type FactCheckMethod =
  | 'comprehensive'        // Default professional analysis
  | 'temporal-verification' // Time-focused analysis
  | 'tiered-verification'; // NEW: Tiered approach

export type UserCategory =
  | 'journalist'
  | 'content-writer'
  | 'blogger'
  | 'technical-writer'
  | 'researcher'
  | 'general';

// Add new interfaces for integrated components
export interface SourceCredibilityReport {
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
}

export interface MediaVerificationReport {
  hasVisualContent: boolean;
  reverseImageResults: {
    matchFound: boolean;
    originalSource?: string;
    firstAppearance?: string;
  }[];
  videoAnalysis?: {
    frameAnalysis: string[];
    metadataCheck: string;
  };
}

export interface TimelineEvent {
    event: string;
    date: string;
}


// New interface for preliminary analysis from AI
export interface PreliminaryAnalysis {
    preliminaryVerdict: string;
    preliminaryScore: number;
    claims: {
        claim: string;
        justification: string;
        searchQuery: string;
    }[];
    textSegments: {
        text: string;
        score: number;
    }[];
}

export interface Segment {
    text: string;
    score: number;
    color: 'green' | 'yellow' | 'red' | 'default';
    temporalIssues?: boolean;
}

// --- Core Report Structure ---

export interface ScoreMetric {
    name: 'Source Reliability' | 'Corroboration' | 'Directness' | 'Freshness' | 'Contradiction' | 'Cached Confidence' | 'Internal Knowledge' | 'Error Status' | 'Claim Verification' | 'Temporal Accuracy';
    score: number; // 0-100
    description: string;
}

export interface ScoreBreakdown {
    final_score_formula: string;
    metrics: ScoreMetric[];
    confidence_intervals?: {
        lower_bound: number;
        upper_bound: number;
    };
}

export interface EvidenceItem {
    id: string;
    publisher: string;
    url: string | null;
    quote: string;
    score: number; // 0-100 reliability score
    type: 'claim' | 'news' | 'search_result' | 'cached-database' | 'academic';
    publishedDate?: string;
}

export interface FactCheckMetadata {
    method_used: string;
    processing_time_ms: number;
    apis_used: string[];
    sources_consulted: {
        total: number;
        high_credibility: number;
        conflicting: number;
    };
    warnings: string[];
}

export interface TemporalValidation {
  isValid: boolean;
  context: string;
  confidence: number;
  dateType: 'past' | 'present' | 'near_future' | 'far_future';
  reasoning: string;
}

export interface TemporalAnalysis {
  hasTemporalClaims: boolean;
  validations: TemporalValidation[];
  overallTemporalScore: number;
  temporalWarnings: string[];
}

export interface CategoryRating {
  category: 'true' | 'mostly-true' | 'half-true' | 'mostly-false' | 'false' | 'pants-on-fire' | 'unverifiable' | 'outdated' | 'misleading-context';
  confidence: number;
  numericScore: number;
  reasoning: string;
  evidenceStrength: 'strong' | 'moderate' | 'weak' | 'insufficient';
  certaintyLevel: 'high' | 'medium' | 'low';
}

export interface SourceCredibilityData {
  domain: string;
  credibilityScore: number; // 0-100
  biasRating: 'left' | 'lean-left' | 'center' | 'lean-right' | 'right' | 'unknown';
  factualReporting: 'very-high' | 'high' | 'mixed' | 'low' | 'very-low';
  category: 'academic' | 'news' | 'government' | 'ngo' | 'corporate' | 'social' | 'blog';
  lastUpdated: Date;
  verificationStatus: 'verified' | 'unverified' | 'flagged';
  notes?: string;
}

export interface SourceCredibilityAnalysis {
  analyses: any[];
  averageCredibility: number;
  biasWarnings: string[];
  credibilityWarnings: string[];
  highCredibilitySources?: number;
  flaggedSources?: number;
}

// Enhanced FactCheckReport
export interface FactCheckReport {
    id: string;
    originalText: string;
    final_verdict: string;
    final_score: number; // 0-100
    score_breakdown: ScoreBreakdown;
    evidence: EvidenceItem[];
    metadata: FactCheckMetadata;
    searchEvidence?: SearchEvidence;
    originalTextSegments?: Segment[]; // NEW: Color-coded text segments
    reasoning?: string; // NEW: AI's explanation for the verdict
    enhanced_claim_text: string;
    correctionAnalysis?: any;
    availableCorrections?: number;
    category_rating?: CategoryRating;

    // NEW: Integrated components
    source_credibility_report: SourceCredibilityReport;
    media_verification_report?: MediaVerificationReport;
    temporal_verification: {
        hasTemporalClaims: boolean;
        validations: TemporalValidation[];
        overallTemporalScore: number;
        temporalWarnings: string[];
        timelineAnalysis?: {
            events: TimelineEvent[];
            consistency: number;
        };
    };

    // Enhanced metadata
    user_category_recommendations: {
        category: UserCategory;
        suitabilityScore: number;
        reasoning: string;
    }[];
}


// --- New Types for Backend Logic & Orchestration ---

export interface ClaimNormalization {
    original_claim: string;
    normalized_claim: string;
    keywords: string[];
}

export interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    source: string;
}

export interface SearchEvidence {
    query: string;
    results: SearchResult[];
}

// --- New Type for History ---

export interface HistoryEntry {
    id: string;
    timestamp: string;
    claimText: string;
    report: FactCheckReport;
}

// Represents the structured, detailed analysis from the core AI model
export interface GeminiAnalysis {
    overallScore: number;
    summary: string;
    claims: {
        claim: string;
        status: "Verified" | "Unverified" | "Misleading" | "False" | "Needs Context";
        explanation: string;
        sources: { name: string; url: string; }[];
    }[];
    sourceAnalysis: {
        source: string;
        credibility: "High" | "Medium" | "Low";
        bias: string;
    }[];
    biasAnalysis: {
        biasDetected: boolean;
        biasType: string;
        explanation: string;
    };
    sentimentAnalysis: {
        sentiment: "Positive" | "Neutral" | "Negative" | "Mixed";
        score: number;
    };
}

// Represents the final output after reconciling different data sources
export interface HybridReconciliation {
    reconciled_verdict: string;
    confidence_score: number;
    reasoning: string;
    conflicts: {
        source_a: string;
        source_b: string;
        description: string;
    }[];
}