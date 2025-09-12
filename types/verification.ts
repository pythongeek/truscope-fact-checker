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
