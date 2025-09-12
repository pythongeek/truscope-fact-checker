export interface VerificationContext {
  topic?: string;
  sourceType?: 'news' | 'academic' | 'government';
}

export interface SearchStrategy {
  query: string;
  engine: 'Google' | 'Bing' | 'DuckDuckGo'; // Simulated engines
  sourceType: 'general' | 'news' | 'academic' | 'forum';
}

export interface EvidenceItem {
  strategy: SearchStrategy;
  title: string;
  url: string;
  snippet: string;
  credibilityScore?: number;
  isRelevant?: boolean;
}

export interface ScoredEvidence extends EvidenceItem {
  credibilityScore: number;
  isRelevant: boolean;
}

export interface SearchResult {
  claim: string;
  isVerified: boolean;
  confidenceScore: number;
  summary: string;
  evidence: ScoredEvidence[];
}
