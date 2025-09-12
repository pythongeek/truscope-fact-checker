export interface VerificationContext {
  topic?: string;
  sourceType?: 'news' | 'academic' | 'government';
}

export type SearchType = 'primary' | 'academic' | 'news' | 'expert' | 'historical' | 'counter' | 'recent';

export interface SearchStrategy {
  search_type: SearchType;
  queries: string[];
  target_sources: string[];
  verification_angle: string;
}

export interface SourceItem {
  name: string;
  type: 'government' | 'academic' | 'news' | 'factcheck' | 'expert' | 'other';
  content: string;
  url: string;
}

export interface CredibilityScore {
  criteria: {
    SOURCE_AUTHORITY: { score: number; reasoning: string };
    EDITORIAL_STANDARDS: { score: number; reasoning: string };
    EXPERTISE_RELEVANCE: { score: number; reasoning: string };
    CORROBORATION: { score: number; reasoning: string };
    RECENCY: { score: number; reasoning: string };
    TRANSPARENCY: { score: number; reasoning: string };
  };
  overallScore: number;
  summary: string;
}

export interface SourceAnalysis extends SourceItem {
  credibility: CredibilityScore;
}

export interface OverallCredibilityResult {
  overallScore: number;
  consensus: 'strong' | 'moderate' | 'weak' | 'none';
  contradictionAnalysis: string;
}

export interface VerificationResult {
  claim: string;
  isVerified: boolean;
  confidenceScore: number;
  summary: string;
  sourceAnalysis: SourceAnalysis[];
  overallCredibility: OverallCredibilityResult;
}
