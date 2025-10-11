// src/types/factCheck.ts
import { FactCheckMethod } from "./enums";
import { EvidenceItem, FactVerdict, ScoreBreakdown } from ".";

export interface Evidence {
  url: string;
  title: string;
  snippet: string;
  publisher: string;
  publicationDate?: string;
  credibilityScore: number;
  relevanceScore: number;
}

export interface ClaimVerificationResult {
  id: string;
  claimText: string;
  status: 'Verified' | 'Unverified' | 'Misleading' | 'Accurate' | 'Needs Context' | 'Error';
  confidenceScore: number;
  explanation: string;
  reasoning: {
    totalSources: number;
    supportingSources: number;
    conflictingSources: number;
    conclusion: string;
  };
  evidence: Evidence[];
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

export interface Segment {
    text: string;
    color: string;
    score: number;
    temporalIssues?: any;
}


export interface PublishingContext {
  platform: 'Web' | 'Social Media' | 'Print';
  audience: 'General' | 'Academic' | 'Specialized';
}

export interface SearchPhaseResult {
  service: string;
  query: string;
  results: Evidence[];
}

export interface NewsSource {
    name: string;
    url: string;
}
export interface SearchParams {
    query: string;
    fromDate?: string;
    toDate?: string;
    sources?: NewsSource[];
}
export interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
    source: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  // Rename 'query' to 'claimText' for consistency with components.
  claimText: string;
  report: any; // Or a more specific type if available
}

export interface FactCheckMetadata {
  // Use camelCase for consistency and fix errors in MethodologyView
  method: FactCheckMethod;
  processingTime: number; // Renamed from processing_time_ms
  sourcesConsulted: number; // Renamed from sources_consulted

  // Add missing properties
  url?: string;
  publicationDate?: string;
  warnings?: string[];
  apisUsed?: string[];
  tierBreakdown?: any;
}

export interface SourceReliabilityScore {
  score: number;
  reasoning: string;
  // Add the missing optional property
  lastUpdated?: string;
}
