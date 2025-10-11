// src/types/index.ts

export * from './factCheck';
export * from './corrections';
export * from './apiKeys';
export * from './advancedEditor';
export * from './factDatabase';

export type FactCheckMethod = 'TIERED' | 'ENHANCED' | 'GOOGLE_ONLY' | 'COMPREHENSIVE' | 'BING_ONLY';
export type EditorMode = 'neutral' | 'constructive' | 'critical' | 'quick-fix';
export type FactVerdict = 'Accurate' | 'Inaccurate' | 'Misleading' | 'Uncertain' | 'TRUE' | 'FALSE' | 'MIXED' | 'MOSTLY TRUE' | 'MOSTLY FALSE';

export interface EvidenceItem {
    id: string;
    url: string;
    title: string;
    snippet: string;
    source: string;
    publisher: string;
    quote: string;
    score: number;
    type: string;
    publishedDate?: string;
}

export interface ScoreBreakdown {
    [key: string]: {
        score: number;
        reasoning: string;
    };
}

export interface FactCheckReport {
    id: string;
    originalText: string;
    summary: string;
    overallAuthenticityScore: number;
    claimVerifications: any[]; // Replace 'any' with a proper type if available
    evidence: EvidenceItem[];
    final_score: number;
    final_verdict: FactVerdict;
    reasoning: string;
    score_breakdown: ScoreBreakdown;
    enhanced_claim_text?: string;
    originalTextSegments?: any[]; // Replace 'any' with a proper type if available
    searchEvidence?: any; // Replace 'any' with a proper type if available
    metadata?: {
        url?: string;
        publicationDate?: string;
        method_used?: string;
        processing_time_ms?: number;
        sources_consulted?: any; // Replace 'any' with a proper type if available
        warnings?: string[];
        apis_used?: string[];
        tier_breakdown?: any; // Replace 'any' with a proper type if available
    };
}

export interface TieredFactCheckResult {
    report: FactCheckReport;
    metadata: any; // Replace 'any' with a proper type if available
}

export interface Segment {
    text: string;
    color: string;
}

export interface HistoryEntry {
    id: string;
    timestamp: string;
    query: string;
    report: FactCheckReport;
}

export interface FactCheckMetadata {
    method: FactCheckMethod;
    processingTime: number;
    sourcesConsulted: number;
}

export interface ScoreMetric {
    name: string;
    score: number;
    reasoning: string;
}

export interface SearchEvidence {
    title: string;
    url:'string'
    snippet: string;
}

export interface SourceReliabilityScore {
    source: string;
    domain: string;
    score: number;
    justification: string;
    reliabilityScore: number;
    category: string;
    biasRating: string;
}

export interface PublishingContext {
    platform: 'Web' | 'Social Media' | 'Print';
    audience: 'General' | 'Academic' | 'Specialized';
}
