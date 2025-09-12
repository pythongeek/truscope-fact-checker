// AI CODING INSTRUCTION: Define comprehensive types for the verification system
// These interfaces should support all verification workflows and data structures

export interface SearchStrategy {
  search_type: 'primary' | 'academic' | 'news' | 'expert' | 'historical' | 'counter' | 'recent';
  queries: string[];
  target_sources: SourceType[];
  verification_angle: string;
  priority: number;
}

export interface SourceType {
  category: 'government' | 'academic' | 'news' | 'factcheck' | 'expert' | 'industry';
  subcategory?: string;
  credibility_baseline: number;
}

export interface SourceItem {
  name: string;
  type: SourceType;
  url: string;
  content: string;
  publication_date: string;
  author?: string;
  credibility_indicators: {
    editorial_process: boolean;
    peer_reviewed: boolean;
    fact_checked: boolean;
    corrections_policy: boolean;
  };
}

export interface CredibilityScore {
  overall_score: number;
  component_scores: {
    source_authority: number;
    editorial_standards: number;
    expertise_relevance: number;
    corroboration: number;
    recency: number;
    transparency: number;
  };
  reasoning: {
    [key: string]: string;
  };
  confidence_interval: [number, number];
}

export interface EvidenceItem {
  claim_support: 'strong_support' | 'weak_support' | 'neutral' | 'weak_contradiction' | 'strong_contradiction';
  evidence_text: string;
  source: SourceItem;
  credibility_score: CredibilityScore;
  extraction_confidence: number;
}

export interface VerificationResult {
  claim: string;
  verification_status: 'verified' | 'partially_verified' | 'disputed' | 'unverifiable';
  confidence_score: number;
  evidence_summary: {
    supporting_evidence: EvidenceItem[];
    contradicting_evidence: EvidenceItem[];
    neutral_evidence: EvidenceItem[];
  };
  source_analysis: SourceAnalysis;
  verification_methodology: string[];
  last_updated: string;
}

export interface SourceAnalysis {
  total_sources: number;
  source_distribution: {
    [key in SourceType['category']]: number;
  };
  credibility_distribution: {
    high: number;    // 80-100
    medium: number;  // 60-79
    low: number;     // 0-59
  };
  consensus_level: number; // 0-100, how much sources agree
  contradiction_level: number; // 0-100, how much sources disagree
}

export type ClaimDomain = 'political' | 'scientific' | 'financial' | 'health' | 'general';

export type DomainWeights = {
  [key in SourceType['category']]?: number;
};

export interface ClaimContext {
  user_profile?: 'novice' | 'expert';
  verification_goal?: 'quick_check' | 'deep_dive';
  region?: string;
  language?: string;
}

export interface PrioritizedSourceList {
  prioritized_sources: {
    source: SourceItem;
    priority_score: number;
    ranking_factors: {
      domain_relevance: number;
      context_relevance: number;
      recency: number;
    };
  }[];
  domain_classification: ClaimDomain;
  prioritization_reasoning: string;
}

export type SearchEngine = 'google' | 'bing' | 'scholarly' | 'news' | 'government';

export interface GoogleSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  date_published: string;
  content_type: 'article' | 'report' | 'study' | 'news' | 'official';
  authority_score: number;
}

export interface ScholarlySearchResult {
  title: string;
  authors: string[];
  journal: string;
  year: number;
  citations: number;
  url: string;
  abstract_snippet: string;
  methodology: 'experimental' | 'survey' | 'review' | 'theoretical';
  peer_reviewed: boolean;
}

export interface NewsSearchResult {
  title: string;
  source: string;
  author: string;
  url: string;
  date_published: string;
  article_snippet: string;
  news_category: 'breaking' | 'analysis' | 'investigation' | 'feature';
  credibility_score: number;
}

export type SimulatedSearchResult = GoogleSearchResult | ScholarlySearchResult | NewsSearchResult;

export interface EngineSearchResult {
  engine: SearchEngine;
  query: string;
  results: SimulatedSearchResult[];
  result_count: number;
  search_quality_score: number;
  unique_domains: string[];
}

export interface ConsensusMetrics {
  domain_consensus: number;
  content_consensus: number;
  authority_consensus: number;
  overall_consensus: number;
}

export interface MultiEngineSearchResult {
  query: string;
  engines_searched: SearchEngine[];
  aggregated_results: SimulatedSearchResult[];
  result_consensus: ConsensusMetrics;
  diversity_metrics: any;
}

export interface VerificationStep {
  id: string;
  label: string;
  weight: number;
}

export interface ProgressUpdate {
  step: string;
  progress: number;
  status: string;
  details?: string;
}

export interface SynthesizedSourceItem {
  source_name: string;
  access_url: string;
  credibility_score: number;
  publication_date: string;
  verification_strength: string;
  relevant_information: string;
}

export interface SourceCollection {
  [key: string]: SynthesizedSourceItem[];
}

export interface SearchResult {
  claim: string;
  isVerified: boolean;
  confidenceScore: number;
  summary: string;
  sources: SourceCollection;
}
