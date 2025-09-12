import { VerificationResult } from './verification';

/**
 * Custom error class for verification-specific issues.
 */
export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

/**
 * Defines the category of a verification error.
 */
export type ErrorType =
  | 'rate_limit'
  | 'network'
  | 'ai_processing'
  | 'input_validation'
  | 'unknown';

/**
 * Callback function to report progress during error handling.
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * Contextual information about the verification operation that failed.
 */
export interface ErrorHandlingContext {
  operationId: string;
  currentProgress: number;
  partialResults?: Partial<VerificationResult>;
  // Add any other relevant context for recovery
  [key: string]: any;
}

// --- Recovery Strategies ---

/**
 * Strategy: Retry the failed operation.
 */
export interface RetryStrategy {
  type: 'retry';
  maxRetries: number;
  baseDelay: number; // in milliseconds
  backoffMultiplier?: number;
}

/**
 * Defines an alternative method to try in a fallback strategy.
 */
export interface FallbackAlternative {
  name: string;
  method: string; // Could be a key to a method implementation
}

/**
 * Strategy: Try one or more alternative approaches.
 */
export interface FallbackStrategy {
  type: 'fallback';
  alternatives: FallbackAlternative[];
}

/**
 * Defines the level of degradation for the graceful degradation strategy.
 */
export type DegradationLevel =
  | 'partial_results' // Return whatever is available
  | 'reduced_accuracy' // Use a simpler, less accurate method
  | 'cache_only'; // Use only cached data

/**
 * Strategy: Provide a degraded but still useful result.
 */
export interface DegradationStrategy {
  type: 'graceful_degradation';
  degradationLevel: DegradationLevel;
}

/**
 * Strategy: Skip the current item and continue the workflow.
 */
export interface SkipAndContinueStrategy {
  type: 'skip_and_continue';
  skipStrategy: 'ignore_invalid_claims' | string;
}

/**
 * A union of all possible recovery strategies.
 */
export type RecoveryStrategy =
  | RetryStrategy
  | FallbackStrategy
  | DegradationStrategy
  | SkipAndContinueStrategy;

/**
 * The result of a recovery attempt.
 */
export interface RecoveryResult {
  success: boolean;
  result?: VerificationResult | Partial<VerificationResult> | any;
  note?: string; // e.g., to indicate a fallback was used
  warnings?: string[];
}
