import { VerificationResult } from './verification';

/**
 * Defines optional settings to guide the verification optimization process.
 */
export interface VerificationOptions {
  /**
   * Specifies the depth of analysis, trading off between thoroughness and speed.
   */
  analysis_depth?: 'full' | 'standard' | 'shallow';
  /**
   * Guides the optimizer to prioritize speed, cost, or accuracy, which can influence model choice.
   */
  priority?: 'speed' | 'cost' | 'accuracy';
  /**
   * If true, forces the optimizer to ignore any cached results and re-verify all claims.
   */
  no_cache?: boolean;
  /**
   * Allows for additional, dynamic options.
   */
  [key: string]: any;
}

/**
 * Represents the result of analyzing a single claim for optimization purposes.
 * This structure is derived from the analysis prompt in the optimizer.
 */
export interface ClaimAnalysis {
  claim: string;
  topic_category: 'political' | 'scientific' | 'financial' | 'health' | 'general';
  complexity_level: 'simple' | 'moderate' | 'complex';
  source_requirements: ('government' | 'academic' | 'news' | 'expert' | 'mixed')[];
  verification_urgency: 'high' | 'medium' | 'low';
  similarity_to_others: number[]; // Indices of similar claims
  estimated_verification_time: number; // in seconds
}

/**
 * Represents a group of similar claims that can be processed together in a single batch.
 */
export interface BatchGroup {
  group_id: string;
  claims: ClaimAnalysis[];
  batch_size: number;
  estimated_time: number;
  shared_sources: string[]; // URLs or domains
  parallel_eligible: boolean;
}

/**
 * Represents a single phase in a parallel execution plan, containing one or more
 * batch groups that can be run concurrently without exceeding resource limits.
 */
export interface ExecutionPhase {
  phase_number: number;
  batch_groups: BatchGroup[];
  estimated_duration: number;
  resource_usage: number;
}

/**
 * Defines the complete, phased plan for executing verification tasks in parallel.
 */
export interface ParallelExecutionPlan {
  total_phases: number;
  phases: ExecutionPhase[];
  estimated_total_time: number;
  parallel_efficiency: number;
}

/**
 * Represents the comprehensive, optimized plan for verifying a set of claims.
 * This is the main output of the `VerificationPerformanceOptimizer`.
 */
export interface OptimizedVerificationPlan {
  total_claims: number;
  cache_hits: number;
  cache_misses: number;
  batch_groups: BatchGroup[];
  estimated_time: number;
  optimization_strategies: string[]; // e.g., 'caching', 'batching'
  parallel_execution_plan: ParallelExecutionPlan;
}

/**
 * Defines the structure for storing verification results in the cache.
 */
export interface CachedVerificationResult {
  result: VerificationResult;
  timestamp: number;
  source: 'cache';
}

/**
 * Represents an item in a batch processing queue, encapsulating the claim
 * and the promise handlers for its asynchronous processing.
 */
export interface BatchQueueItem {
  claim: string;
  context?: any;
  resolve: (result: VerificationResult) => void;
  reject: (error: Error) => void;
}

/**
 * A flexible structure for capturing performance-related metrics.
 */
export interface PerformanceMetrics {
  [key: string]: number | string;
}

/**
 * Represents the final result object returned after executing an optimized verification plan.
 */
export interface OptimizedVerificationResult {
  results: VerificationResult[];
  execution_time: number; // actual time in ms
  estimated_time: number; // estimated time in s
  efficiency_ratio: number; // estimated / actual
  cache_utilization: number; // hits / (hits + misses)
  performance_metrics: PerformanceMetrics;
}
