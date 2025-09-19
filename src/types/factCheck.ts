import { GoogleSearchResult } from '../types';

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
}

// --- Core Report Structure ---

export interface ScoreMetric {
    name: 'Source Reliability' | 'Corroboration' | 'Directness' | 'Freshness' | 'Contradiction';
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
    type: 'claim' | 'news' | 'search_result';
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

export interface FactCheckReport {
    originalText: string;
    final_verdict: string;
    final_score: number; // 0-100
    score_breakdown: ScoreBreakdown;
    evidence: EvidenceItem[];
    metadata: FactCheckMetadata;
    searchEvidence?: SearchEvidence;
    originalTextSegments?: Segment[]; // NEW: Color-coded text segments
    reasoning?: string; // NEW: AI's explanation for the verdict
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
