import { FactVerdict } from '.';

export interface FactDatabase {
  id: string;
  statement: string;
  normalizedStatement: string; // For fuzzy matching
  verdict: FactVerdict;
  confidence: number;
  sources: VerifiedSource[];
  metadata: FactMetadata;
  verification: VerificationInfo;
  trends: TrendingInfo;
}

export interface VerifiedSource {
  url: string;
  publisher: string;
  credibilityScore: number;
  publicationDate: Date;
  relevanceScore: number;
  quote: string;
  authorName?: string;
  sourceType: 'academic' | 'news' | 'government' | 'organization' | 'expert';
}

export interface FactMetadata {
  topic: string;
  category: string[];
  geography?: string;
  timeRelevance: 'historical' | 'current' | 'predictive';
  complexity: 'simple' | 'complex' | 'expert-level';
}

export interface VerificationInfo {
  lastVerified: Date;
  verificationCount: number;
  automaticReverification: boolean;
  nextVerificationDue: Date;
  verificationHistory: VerificationEvent[];
}

export interface TrendingInfo {
  trendingScore: number;
  mentionCount: number;
  platforms: PlatformMention[];
  peakDate?: Date;
  declineRate: number;
}

export interface VerificationEvent {
  date: Date;
  method: string;
  confidence: number;
  source: string;
  notes?: string;
  previousVerdict?: FactVerdict;
  newVerdict?: FactVerdict;
}

export interface PlatformMention {
  platform: 'twitter' | 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'reddit' | 'news' | 'blog' | 'forum';
  mentionCount: number;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  lastMentioned: Date;
  engagementRate: number;
  viralityScore: number; // 0-100 scale
  sourceUrl?: string;
}
