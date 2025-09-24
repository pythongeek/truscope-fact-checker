// src/types/index.ts

import { GoogleSearchResult } from '../types';

// --- Core Report Structure ---

export interface ScoreMetric {
    name: 'Source Reliability' | 'Corroboration' | 'Directness' | 'Freshness' | 'Contradiction' | 'Cached Confidence';
    score: number; // 0-100
    description: string;
    weight?: number;
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
    url?: string | null;
    quote: string;
    score: number; // 0-100 reliability score
    type?: 'claim' | 'news' | 'search_result' | 'cached-database';
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

export interface SearchEvidence {
    query: string;
    results: GoogleSearchResult[];
}

export interface TextSegment {
    id?: string;
    text: string;
    score?: number;
    color?: 'green' | 'yellow' | 'red' | 'default';
    category?: 'claim' | 'evidence' | 'opinion' | 'context' | 'factual_claim' | 'speculation' | 'misleading';
    confidence?: number;
    issues?: string[];
}

export interface FactCheckResult {
    originalText: string;
    final_verdict: string;
    final_score: number; // 0-100
    score_breakdown: ScoreBreakdown;
    evidence: EvidenceItem[];
    metadata: FactCheckMetadata;
    searchEvidence?: SearchEvidence;
    originalTextSegments?: TextSegment[];
    reasoning?: string;
    enhanced_claim_text?: string;
    correctionAnalysis?: any;
    availableCorrections?: number;
}

export type AnalysisMode = 'basic' | 'comprehensive' | 'quick' | 'detailed';

// --- New Types for Backend Logic & Orchestration ---

export interface ClaimNormalization {
    original_claim: string;
    normalized_claim: string;
    keywords: string[];
}

// --- New Type for History ---

export interface HistoryEntry {
  id: string;
  timestamp: number;
  originalText: string;
  result: FactCheckResult;
  mode: AnalysisMode;
  processingTime: number;
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