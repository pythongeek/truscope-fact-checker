/**
 * Defines a strategic approach for searching for evidence related to a claim.
 */
export interface SearchStrategy {
  search_type: 'primary' | 'academic' | 'news' | 'expert' | 'historical' | 'counter' | 'recent';
  queries: string[];
  target_sources: SourceType[];
  verification_angle: string;
  priority: number;
}

/**
 * Represents the type of an information source.
 */
export interface SourceType {
  category: 'government' | 'academic' | 'news' | 'factcheck' | 'expert' | 'industry';
  subcategory?: string;
  credibility_baseline: number;
}

/**
 * Represents a single piece of source material to be analyzed.
 */
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

/**
 * Represents a detailed credibility score for a source, broken down by criteria.
 */
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

/**
 * Represents a piece of evidence extracted from a source, linked to a claim.
 */
export interface EvidenceItem {
  claim_support: 'strong_support' | 'weak_support' | 'neutral' | 'weak_contradiction' | 'strong_contradiction';
  evidence_text: string;
  source: SourceItem;
  credibility_score: CredibilityScore;
  extraction_confidence: number;
}

/**
 * Represents the complete result of a verification process for a single claim.
 */
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

/**
 * Represents a high-level analysis of all sources used for a verification.
 */
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
  consensus_level: number;
  contradiction_level: number;
}

/**
 * Represents the primary subject matter domain of a claim.
 */
export type ClaimDomain = 'political' | 'scientific' | 'financial' | 'health' | 'general';

/**
 * Defines a set of weights for different source categories within a specific claim domain.
 */
export type DomainWeights = {
  [key in SourceType['category']]?: number;
};

/**
 * Represents contextual information about a claim that can guide the verification process.
 */
export interface ClaimContext {
  user_profile?: 'novice' | 'expert';
  verification_goal?: 'quick_check' | 'deep_dive';
  region?: string;
  language?: string;
}

/**
 * Represents the output of the source prioritization process.
 */
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

/**
 * Represents the different types of search engines that can be simulated.
 */
export type SearchEngine = 'google' | 'bing' | 'scholarly' | 'news' | 'government';

/**
 * Represents a simulated search result from Google.
 */
export interface GoogleSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  date_published: string;
  content_type: 'article' | 'report' | 'study' | 'news' | 'official';
  authority_score: number;
}

/**
 * Represents a simulated search result from a scholarly search engine.
 */
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

/**
 * Represents a simulated search result from a news search engine.
 */
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

/**
 * A union type for any possible simulated search result.
 */
export type SimulatedSearchResult = GoogleSearchResult | ScholarlySearchResult | NewsSearchResult;

/**
 * Represents the complete results from a single simulated engine search.
 */
export interface EngineSearchResult {
  engine: SearchEngine;
  query: string;
  results: SimulatedSearchResult[];
  result_count: number;
  search_quality_score: number;
  unique_domains: string[];
}

/**
 * Represents metrics about the consensus between multiple search engine results.
 */
export interface ConsensusMetrics {
  domain_consensus: number;
  content_consensus: number;
  authority_consensus: number;
  overall_consensus: number;
}

/**
 * Represents the aggregated results from a multi-engine simulated search.
 */
export interface MultiEngineSearchResult {
  query: string;
  engines_searched: SearchEngine[];
  aggregated_results: SimulatedSearchResult[];
  result_consensus: ConsensusMetrics;
  diversity_metrics: any;
}

/**
 * Represents a single step in the verification progress indicator.
 */
export interface VerificationStep {
  id: string;
  label: string;
  weight: number;
}

/**
 * Represents a progress update during the verification process.
 */
export interface ProgressUpdate {
  step: string;
  progress: number;
  status: string;
  details?: string;
}

/**
 * Represents a single source item after it has been synthesized for final display.
 * This is a simplified version of SourceItem.
 */
export interface SynthesizedSourceItem {
  source_name: string;
  access_url: string;
  credibility_score: number;
  publication_date: string;
  verification_strength: string;
  relevant_information: string;
}

/**
 * Represents a collection of synthesized sources, categorized by type.
 */
export interface SourceCollection {
  [key: string]: SynthesizedSourceItem[];
}

/**
 * Represents the final, synthesized result of a search and verification process.
 */
export interface SearchResult {
  claim: string;
  isVerified: boolean | null;
  confidenceScore: number;
  summary: string;
  sources: SourceCollection;
  source_analysis?: SourceAnalysis;
}
