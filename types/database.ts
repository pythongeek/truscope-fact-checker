/**
 * @file Provides strict TypeScript interfaces for all database tables.
 * @description Ensures type safety for all data interactions throughout the application.
 */

/**
 * Represents a user in the 'users' table.
 */
export interface User {
  /**
   * The unique identifier for the user.
   */
  id: number;
  /**
   * The user's email address.
   */
  email: string;
  /**
   * The user's subscription level.
   */
  subscription_tier: 'free' | 'pro' | 'enterprise';
  /**
   * The number of API requests or analyses the user has performed.
   */
  usage_count: number;
  /**
   * The timestamp when the user was created.
   */
  created_at: string;
}

/**
 * Represents an article in the 'articles' table.
 */
export interface Article {
  /**
   * The unique identifier for the article.
   */
  id: number;
  /**
   * The title of the article.
   */
  title: string;
  /**
   * The full content of the article.
   */
  content?: string;
  /**
   * The original URL of the article.
   */
  url?: string;
  /**
   * The current status of the analysis for this article.
   */
  analysis_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /**
   * A JSON object for storing any additional metadata.
   */
  metadata?: Record<string, any>;
  /**
   * The timestamp when the article was added to the database.
   */
  created_at: string;
}

/**
 * Represents a factual claim in the 'claims' table, linked to an article.
 */
export interface Claim {
  /**
   * The unique identifier for the claim.
   */
  id: number;
  /**
   * The foreign key linking to the 'articles' table.
   */
  article_id: number;
  /**
   * The text of the factual claim.
   */
  claim_text: string;
  /**
   * The verification status of the claim.
   */
  status: 'unverified' | 'verified' | 'disputed';
  /**
   * A numerical confidence score for the verification status.
   */
  confidence?: number;
  /**
   * An array of URLs for sources related to this claim.
   */
  sources?: string[];
  /**
   * The timestamp when the claim was created.
   */
  created_at: string;
}

/**
 * Represents a source in the 'sources' table.
 */
export interface Source {
  /**
   * The unique identifier for the source.
   */
  id: number;
  /**
   * The URL of the source.
   */
  url: string;
  /**
   * The title of the source page or document.
   */
  title?: string;
  /**
   * A calculated credibility score for the source.
   */
  credibility_score?: number;
  /**
   * A calculated bias rating for the source.
   */
  bias_rating?: number;
  /**
   * The type of the source (e.g., 'news', 'academic').
   */
  type?: string;
  /**
   * The timestamp when this source was last used for verification.
   */
  last_verified?: string;
}

/**
 * Represents a social media mention in the 'social_mentions' table.
 */
export interface SocialMention {
  /**
   * The unique identifier for the mention.
   */
  id: number;
  /**
   * The social media platform where the mention occurred (e.g., 'twitter', 'facebook').
   */
  platform: string;
  /**
   * The URL of the specific mention.
   */
  url?: string;
  /**
   * The content of the social media post.
   */
  content?: string;
  /**
   * A calculated sentiment score for the mention.
   */
  sentiment?: number;
  /**
   * A JSON object for storing engagement metrics (e.g., likes, shares).
   */
  engagement?: Record<string, number>;
  /**
   * The timestamp when the mention was created.
   */
  created_at: string;
}

/**
 * Represents a fact-check result in the 'fact_checks' table.
 */
export interface FactCheck {
  /**
   * The unique identifier for the fact-check.
   */
  id: number;
  /**
   * The foreign key linking to the 'claims' table.
   */
  claim_id: number;
  /**
   * The result or verdict of the fact-check.
   */
  result: string;
  /**
   * A detailed explanation for the fact-check result.
   */
  explanation?: string;
  /**
   * The type of reviewer that performed the fact-check.
   */
  reviewer_type: 'AI' | 'human';
  /**
   * A numerical confidence score for the fact-check.
   */
  confidence?: number;
}
