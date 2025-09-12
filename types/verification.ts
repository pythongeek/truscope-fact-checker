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

export interface SourceResult {
  source_name: string;
  source_type: 'government' | 'academic' | 'news' | 'factcheck' | 'expert';
  credibility_score: number;
  relevant_information: string;
  publication_date: string;
  access_url: string;
  verification_strength: 'strong_support' | 'weak_support' | 'neutral' | 'weak_contradiction' | 'strong_contradiction';
}

export interface SourceCollection {
  primary_sources: SourceResult[];
  news_sources: SourceResult[];
  fact_checking_sources: SourceResult[];
  expert_sources: SourceResult[];
}

export interface SearchResult {
  claim: string;
  isVerified: boolean;
  confidenceScore: number;
  summary: string;
  sources: SourceCollection;
}
