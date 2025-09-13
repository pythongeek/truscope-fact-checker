import {
  VerificationError,
  ErrorHandlingContext,
  ProgressCallback,
  RecoveryResult,
  ErrorType,
  RetryStrategy,
  FallbackStrategy,
  FallbackAlternative,
  DegradationStrategy,
  RecoveryStrategy,
} from '../../types/errorHandler';
import { VerificationResult } from '../../types/verification';

/**
 * A sophisticated error handler for the verification process.
 * It classifies errors and dynamically applies recovery strategies like
 * retries, fallbacks, or graceful degradation.
 */
export class VerificationErrorHandler {
  private retryAttempts = new Map<string, number>();
  private failedOperations = new Set<string>();

  /**
   * The main error handling method. It classifies the error, selects a recovery
   * strategy, and executes it.
   *
   * @param {VerificationError} error - The error that occurred.
   * @param {ErrorHandlingContext} context - The context of the operation when the error occurred.
   * @param {ProgressCallback} [onProgress] - An optional callback to report progress.
   * @returns {Promise<RecoveryResult>} A promise that resolves to the result of the recovery attempt.
   */
  async handleVerificationError(
    error: VerificationError,
    context: ErrorHandlingContext,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    const errorType = this.classifyError(error);
    const recoveryStrategy = this.getRecoveryStrategy(errorType, context);

    onProgress?.(context.currentProgress, `Handling error: ${error.message}. Strategy: ${recoveryStrategy.type}.`);

    switch (recoveryStrategy.type) {
      case 'retry':
        return await this.handleRetryStrategy(error, context, recoveryStrategy, onProgress);
      case 'fallback':
        return await this.handleFallbackStrategy(error, context, recoveryStrategy, onProgress);
      case 'graceful_degradation':
        return await this.handleGracefulDegradation(error, context, recoveryStrategy);
      case 'skip_and_continue':
        return await this.handleSkipAndContinue(error, context);
      default:
        const exhaustiveCheck: never = recoveryStrategy;
        return this.handleFatalError(error, context, `Unhandled recovery strategy: ${exhaustiveCheck}`);
    }
  }

  /**
   * Handles the 'retry' recovery strategy, attempting to re-run an operation with a delay.
   * @private
   */
  private async handleRetryStrategy(
    error: VerificationError,
    context: ErrorHandlingContext,
    strategy: RetryStrategy,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    const operationId = context.operationId;
    const currentAttempts = this.retryAttempts.get(operationId) || 0;

    if (currentAttempts >= strategy.maxRetries) {
      onProgress?.(context.currentProgress, `Retry limit reached for ${operationId}. Escalating to fallback.`);
      this.retryAttempts.delete(operationId);
      return this.escalateToFallback(error, context, onProgress);
    }

    const nextAttempt = currentAttempts + 1;
    this.retryAttempts.set(operationId, nextAttempt);

    const delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier || 2, currentAttempts);
    onProgress?.(context.currentProgress, `Retrying operation ${operationId} (attempt ${nextAttempt}/${strategy.maxRetries}) after ${delay}ms...`);
    await this.delay(delay);

    try {
      const result = await this.retryOperation(context);
      this.retryAttempts.delete(operationId);
      return { success: true, result };
    } catch (retryError) {
      return this.handleVerificationError(retryError as VerificationError, context, onProgress);
    }
  }

  /**
   * Handles the 'fallback' recovery strategy, trying a series of alternative methods.
   * @private
   */
  private async handleFallbackStrategy(
    error: VerificationError,
    context: ErrorHandlingContext,
    strategy: FallbackStrategy,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    onProgress?.(context.currentProgress, `Attempting fallback strategies...`);
    for (const fallback of strategy.alternatives) {
      try {
        onProgress?.(context.currentProgress, `Trying fallback: ${fallback.name}`);
        const result = await this.executeFallback(fallback, context);
        return {
          success: true,
          result,
          note: `Used fallback strategy: ${fallback.name}`,
        };
      } catch (fallbackError) {
        console.warn(`Fallback '${fallback.name}' failed:`, (fallbackError as Error).message);
        continue;
      }
    }

    onProgress?.(context.currentProgress, 'All fallback strategies failed. Degrading gracefully.');
    return this.handleGracefulDegradation(error, context, {
      type: 'graceful_degradation',
      degradationLevel: 'partial_results',
    });
  }

  /**
   * Handles the 'graceful_degradation' strategy, returning partial, cached, or less accurate results.
   * @private
   */
  private async handleGracefulDegradation(
    error: VerificationError,
    context: ErrorHandlingContext,
    strategy: DegradationStrategy
  ): Promise<RecoveryResult> {
    switch (strategy.degradationLevel) {
      case 'partial_results':
        return {
          success: true,
          result: context.partialResults,
          warnings: [`Verification incomplete. Returning partial results due to: ${error.message}`],
        };
      case 'reduced_accuracy':
        const simplifiedResult = await this.performSimplifiedVerification(context);
        return {
          success: true,
          result: simplifiedResult,
          warnings: [`Verification accuracy reduced due to: ${error.message}`],
        };
      case 'cache_only':
        const cachedResult = await this.getCachedResults(context);
        if (cachedResult) {
          return {
            success: true,
            result: cachedResult,
            warnings: [`Using stale cached results due to: ${error.message}`],
          };
        }
        break;
    }

    return this.handleFatalError(error, context, `Graceful degradation failed: ${strategy.degradationLevel}`);
  }

  /**
   * Handles the 'skip_and_continue' strategy for non-critical errors.
   * @private
   */
  private async handleSkipAndContinue(
    error: VerificationError,
    context: ErrorHandlingContext
  ): Promise<RecoveryResult> {
    const message = `Skipping operation ${context.operationId} due to input validation error: ${error.message}`;
    console.warn(message);
    this.failedOperations.add(context.operationId);
    return {
      success: true,
      result: null,
      note: 'Operation skipped.',
      warnings: [message],
    };
  }

  /**
   * Handles unrecoverable errors by marking the operation as failed.
   * @private
   */
  private handleFatalError(error: VerificationError, context: ErrorHandlingContext, note?: string): Promise<RecoveryResult> {
    const message = `Fatal error during verification for operation ${context.operationId}: ${error.message}`;
    console.error(message, { context });
    this.failedOperations.add(context.operationId);
    return Promise.resolve({
      success: false,
      result: null,
      note: note || 'An unrecoverable error occurred.',
      warnings: [message],
    });
  }

  /**
   * Classifies a VerificationError into a specific ErrorType.
   * @private
   */
  private classifyError(error: VerificationError): ErrorType {
    const msg = error.message.toLowerCase();
    if (msg.includes('quota') || msg.includes('rate limit') || error.toString().includes('429')) {
      return 'rate_limit';
    }
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('dns')) {
      return 'network';
    }
    if (msg.includes('safety') || msg.includes('parse') || msg.includes('model error')) {
      return 'ai_processing';
    }
    if (msg.includes('invalid') || msg.includes('configuration') || msg.includes('missing parameter')) {
      return 'input_validation';
    }
    return 'unknown';
  }

  /**
   * Selects an appropriate recovery strategy based on the error type.
   * @private
   */
  private getRecoveryStrategy(errorType: ErrorType, context: ErrorHandlingContext): RecoveryStrategy {
    const strategies: Record<ErrorType, RecoveryStrategy> = {
      rate_limit: { type: 'retry', maxRetries: 3, baseDelay: 60000, backoffMultiplier: 2 },
      network: { type: 'retry', maxRetries: 3, baseDelay: 2000, backoffMultiplier: 2 },
      ai_processing: { type: 'fallback', alternatives: [{ name: 'simplified_prompt', method: 'useSimplifiedPrompt' }, { name: 'different_model', method: 'useDifferentModel' }] },
      input_validation: { type: 'skip_and_continue', skipStrategy: 'ignore_invalid_claims' },
      unknown: { type: 'graceful_degradation', degradationLevel: 'partial_results' },
    };
    return strategies[errorType];
  }

  /**
   * Escalates a failed retry attempt to a fallback strategy.
   * @private
   */
  private async escalateToFallback(
    error: VerificationError,
    context: ErrorHandlingContext,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    const fallbackStrategy: FallbackStrategy = {
      type: 'fallback',
      alternatives: [{ name: 'use_cached_or_degraded', method: 'useCachedOrDegraded' }],
    };
    return this.handleFallbackStrategy(error, context, fallbackStrategy, onProgress);
  }

  /**
   * Creates a delay for a specified number of milliseconds.
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * **[Placeholder]** The consumer of this class must implement this method.
   * It should contain the logic to re-run the failed operation.
   * @protected
   * @param {ErrorHandlingContext} context - The context of the operation to retry.
   * @returns {Promise<VerificationResult>} The result of the successful operation.
   */
  protected async retryOperation(context: ErrorHandlingContext): Promise<VerificationResult> {
    console.log(`[Placeholder] Retrying operation: ${context.operationId}`);
    return Promise.reject(new VerificationError('Simulated persistent failure during retry.'));
  }

  /**
   * **[Placeholder]** The consumer of this class must implement this method.
   * It should execute a specific fallback alternative based on the provided strategy.
   * @protected
   * @param {FallbackAlternative} fallback - The fallback strategy to execute.
   * @param {ErrorHandlingContext} context - The context of the operation.
   * @returns {Promise<VerificationResult>} The result from the successful fallback.
   */
  protected async executeFallback(fallback: FallbackAlternative, context: ErrorHandlingContext): Promise<VerificationResult> {
    console.log(`[Placeholder] Executing fallback: ${fallback.name}`);
    if (fallback.method !== 'useCachedOrDegraded') {
        return Promise.reject(new VerificationError(`Simulated failure for fallback: ${fallback.name}`));
    }
    return Promise.resolve({
        claim: 'Claim from fallback',
        isVerified: false,
        summary: 'Fallback summary',
        confidenceScore: 50,
        evidence: [],
    } as unknown as VerificationResult);
  }

  /**
   * **[Placeholder]** The consumer of this class can implement this method.
   * It should perform a simplified, lower-accuracy verification as a degradation step.
   * @protected
   * @param {ErrorHandlingContext} context - The context of the operation.
   * @returns {Promise<Partial<VerificationResult>>} The partial or simplified result.
   */
  protected async performSimplifiedVerification(context: ErrorHandlingContext): Promise<Partial<VerificationResult>> {
    console.log(`[Placeholder] Performing simplified verification for ${context.operationId}`);
    return {
      confidenceScore: 40,
      summary: 'Result generated using a reduced-accuracy method.',
    };
  }

  /**
   * **[Placeholder]** The consumer of this class can implement this method.
   * It should attempt to retrieve results from a cache.
   * @protected
   * @param {ErrorHandlingContext} context - The context of the operation.
   * @returns {Promise<VerificationResult | null>} The cached result, or null if not found.
   */
  protected async getCachedResults(context: ErrorHandlingContext): Promise<VerificationResult | null> {
    console.log(`[Placeholder] Checking cache for ${context.operationId}`);
    return null;
  }
}
