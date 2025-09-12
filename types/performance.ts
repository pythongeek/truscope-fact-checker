import { VerificationResult } from './verification';

/**
 * Optional settings to guide the verification optimization process.
 */
export interface VerificationOptions {
  // e.g., 'deep_dive' vs 'quick_check'
  analysis_depth?: 'full' | 'standard' | 'shallow';
  // Prioritize speed or cost, which might influence model choice
  priority?: 'speed' | 'cost' | 'accuracy';
  // Force a cache refresh
  no_cache?: boolean;
  [key: string]: any;
}

/**
 * The result of analyzing a single claim for optimization purposes.
 * This structure is derived from the analysis prompt in the optimizer.
 */
export interface ClaimAnalysis {
  claim: string;
  topic_category: 'political' | 'scientific' | 'financial' | 'health' | 'general';
  complexity_level: 'simple' | 'moderate' | 'complex';
  source_requirements: ('government' | 'academic' | 'news' | 'expert' | 'mixed')[];
  verification_urgency: 'high' | 'medium' | 'low';
  similarity_to_others: number[]; // Indices of similar claims in the original array
  estimated_verification_time: number; // in seconds
}

/**
 * A group of similar claims that can be processed together in a batch.
 */
export interface BatchGroup {
  group_id: string;
  claims: ClaimAnalysis[];
  batch_size: number;
  estimated_time: number;
  shared_sources: string[]; // URLs or domains of shared sources
  parallel_eligible: boolean;
}

/**
 * Represents a single phase in the parallel execution plan.
 * A phase contains one or more batch groups that can run concurrently.
 */
export interface ExecutionPhase {
  phase_number: number;
  batch_groups: BatchGroup[];
  estimated_duration: number;
  resource_usage: number; // A metric for how many resources this phase uses
}

/**
 * The complete, phased plan for executing verification tasks in parallel.
 */
export interface ParallelExecutionPlan {
  total_phases: number;
  phases: ExecutionPhase[];
  estimated_total_time: number;
  parallel_efficiency: number; // A score from 0 to 1
}

/**
 * The comprehensive, optimized plan for verifying a set of claims.
 * This is the main output of the `optimizeVerificationWorkflow` method.
 */
export interface OptimizedVerificationPlan {
  total_claims: number;
  cache_hits: number;
  cache_misses: number;
  batch_groups: BatchGroup[];
  estimated_time: number;
  optimization_strategies: string[]; // e.g., ['batching', 'caching', 'parallelism']
  parallel_execution_plan: ParallelExecutionPlan;
}

/**
 * The structure for storing verification results in the cache.
 */
export interface CachedVerificationResult {
  result: VerificationResult;
  timestamp: number;
  source: 'cache';
}

/**
 * An item in the batch processing queue.
 */
export interface BatchQueueItem {
  claim: string;
  // The VerificationContext could be used here if needed
  context?: any;
  // Promises to resolve/reject when the batch is processed
  resolve: (result: VerificationResult) => void;
  reject: (error: Error) => void;
}

/**
 * A flexible structure for performance-related metrics.
 */
export interface PerformanceMetrics {
  [key: string]: number | string;
}

/**
 * The final result object returned after executing an optimized verification plan.
 */
export interface OptimizedVerificationResult {
  results: VerificationResult[];
  execution_time: number; // actual time in ms
  estimated_time: number; // estimated time in ms
  efficiency_ratio: number; // estimated / actual
  cache_utilization: number; // hits / (hits + misses)
  performance_metrics: PerformanceMetrics;
}
