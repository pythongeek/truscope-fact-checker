import { VerificationResult } from './verification';

/**
 * Custom error class for handling issues specific to the verification process.
 * This allows for more specific error catching and handling than a generic Error.
 */
export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

/**
 * Defines the high-level category of a verification error, used to determine
 * the appropriate recovery strategy.
 */
export type ErrorType =
  | 'rate_limit'        // The API rate limit has been exceeded.
  | 'network'           // A network-related error occurred (e.g., timeout, DNS issue).
  | 'ai_processing'     // The AI model failed to process the request (e.g., safety violation, parsing error).
  | 'input_validation'  // The input provided to a function was invalid.
  | 'unknown';            // An error of an unknown type occurred.

/**
 * A callback function signature for reporting progress during long-running operations,
 * especially within an error handling context.
 * @param {number} progress - A numerical representation of progress (e.g., 0-100).
 * @param {string} message - A descriptive message about the current status.
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * Provides contextual information about the operation that failed, which is essential
 * for making intelligent decisions about how to recover.
 */
export interface ErrorHandlingContext {
  /**
   * A unique identifier for the specific operation that failed.
   */
  operationId: string;
  /**
   * The progress percentage at which the error occurred.
   */
  currentProgress: number;
  /**
   * Any partial results that were successfully generated before the error occurred.
   */
  partialResults?: Partial<VerificationResult>;
  /**
   * Allows for additional, dynamic context to be passed.
   */
  [key: string]: any;
}

// --- Recovery Strategies ---

/**
 * Defines the 'retry' recovery strategy, which involves re-attempting the failed operation.
 */
export interface RetryStrategy {
  type: 'retry';
  /**
   * The maximum number of times to retry the operation.
   */
  maxRetries: number;
  /**
   * The initial delay in milliseconds before the first retry.
   */
  baseDelay: number;
  /**
   * The multiplier for exponential backoff (e.g., 2 for doubling the delay each time).
   */
  backoffMultiplier?: number;
}

/**
 * Defines a single alternative method to be tried as part of a FallbackStrategy.
 */
export interface FallbackAlternative {
  /**
   * The user-friendly name of the fallback method.
   */
  name: string;
  /**
   * A key or identifier for the method implementation to be called.
   */
  method: string;
}

/**
 * Defines the 'fallback' recovery strategy, which involves trying one or more
 * alternative approaches if the primary method fails.
 */
export interface FallbackStrategy {
  type: 'fallback';
  /**
   * An ordered list of alternative methods to try.
   */
  alternatives: FallbackAlternative[];
}

/**
 * Defines the specific level of degradation for the GracefulDegradation strategy.
 */
export type DegradationLevel =
  | 'partial_results'   // Return whatever partial data is available.
  | 'reduced_accuracy'  // Use a simpler, faster, but less accurate method to get a result.
  | 'cache_only';       // Attempt to return a result from a cache, even if it's stale.

/**
 * Defines the 'graceful_degradation' strategy, which aims to provide a useful,
 * albeit incomplete or less accurate, result instead of failing completely.
 */
export interface DegradationStrategy {
  type: 'graceful_degradation';
  degradationLevel: DegradationLevel;
}

/**
 * Defines the 'skip_and_continue' strategy, used for non-critical errors where
 * the best course of action is to ignore the failed item and proceed.
 */
export interface SkipAndContinueStrategy {
  type: 'skip_and_continue';
  /**
   * A string describing the specific skip strategy (e.g., 'ignore_invalid_claims').
   */
  skipStrategy: 'ignore_invalid_claims' | string;
}

/**
 * A union type representing all possible recovery strategies that the error handler can employ.
 */
export type RecoveryStrategy =
  | RetryStrategy
  | FallbackStrategy
  | DegradationStrategy
  | SkipAndContinueStrategy;

/**
 * Represents the outcome of a recovery attempt made by the error handler.
 */
export interface RecoveryResult {
  /**
   * A boolean indicating whether the recovery attempt was successful.
   */
  success: boolean;
  /**
   * The result of the recovery, which could be a full, partial, or alternative result.
   */
  result?: VerificationResult | Partial<VerificationResult> | any;
  /**
   * An optional note to provide additional information about the recovery (e.g., "Used fallback strategy X").
   */
  note?: string;
  /**
   * An array of warning messages generated during the recovery process.
   */
  warnings?: string[];
}
