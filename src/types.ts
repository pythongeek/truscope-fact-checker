export type ClaimStatus = "Verified" | "Unverified" | "Misleading" | "False" | "Needs Context";

export interface Claim {
  claim: string;
  status: ClaimStatus;
  explanation: string;
  sources: {
    name: string;
    url: string;
  }[];
}

export interface SourceAnalysis {
  source: string;
  credibility: "High" | "Medium" | "Low";
  bias: string;
}

export interface BiasAnalysis {
  biasDetected: boolean;
  biasType: string;
  explanation: string;
}

export interface SentimentAnalysis {
  sentiment: "Positive" | "Neutral" | "Negative" | "Mixed";
  score: number;
}

export interface AnalysisResult {
  overallScore: number;
  summary: string;
  claims: Claim[];
  sourceAnalysis: SourceAnalysis[];
  biasAnalysis: BiasAnalysis;
  sentimentAnalysis: SentimentAnalysis;
  newsArticles?: NewsArticle[];
}

export interface AnalysisError {
  message: string;
}

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  source?: string;
}

export interface NewsArticle {
  title: string;
  link: string;
  description: string | null;
  pubDate: string;
  source: string;
}

export interface EvidenceItem {
  id: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  title: string;
  snippet: string;
  confidence_score: number; // Placeholder for now, will be calculated later
  retrieved_at: string;
  metadata: {
    author: string | null;
    domain_authority: number | null; // Placeholder
    api_source: 'serp' | 'newsdata' | 'google' | 'other';
  };
}