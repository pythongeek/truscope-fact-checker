/**
 * @file Provides strict TypeScript interfaces for all database tables.
 * @description Ensures type safety for all data interactions throughout the application.
 */

/**
 * Represents a user in the 'users' table.
 */
export interface User {
  id: number;
  email: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  usage_count: number;
  created_at: string;
}

/**
 * Represents an article in the 'articles' table.
 */
export interface Article {
  id: number;
  title: string;
  content?: string;
  url?: string;
  analysis_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Represents a factual claim in the 'claims' table.
 */
export interface Claim {
  id: number;
  article_id: number;
  claim_text: string;
  status: 'unverified' | 'verified' | 'disputed';
  confidence?: number;
  sources?: string[];
  created_at: string;
}

/**
 * Represents a source in the 'sources' table.
 */
export interface Source {
  id: number;
  url: string;
  title?: string;
  credibility_score?: number;
  bias_rating?: number;
  type?: string;
  last_verified?: string;
}

/**
 * Represents a social media mention in the 'social_mentions' table.
 */
export interface SocialMention {
  id: number;
  platform: string;
  url?: string;
  content?: string;
  sentiment?: number;
  engagement?: Record<string, number>;
  created_at: string;
}

/**
 * Represents a fact-check result in the 'fact_checks' table.
 */
export interface FactCheck {
  id: number;
  claim_id: number;
  result: string;
  explanation?: string;
  reviewer_type: 'AI' | 'human';
  confidence?: number;
}
