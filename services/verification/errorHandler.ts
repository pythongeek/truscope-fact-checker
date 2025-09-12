import {
  VerificationError,
  VerificationContext,
  ProgressCallback,
  RecoveryResult,
  ErrorType,
  RetryStrategy,
  FallbackStrategy,
  FallbackAlternative,
  DegradationStrategy,
  SkipAndContinueStrategy,
  RecoveryStrategy,
} from '../../types/errorHandler';
import { VerificationResult } from '../../types/verification';

export class VerificationErrorHandler {
  private retryAttempts = new Map<string, number>();
  private failedOperations = new Set<string>();

  // --- Public Methods ---

  async handleVerificationError(
    error: VerificationError,
    context: VerificationContext,
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
        return await this.handleSkipAndContinue(error, context, recoveryStrategy);
      default:
        // This should be unreachable if all strategies are handled.
        // Using a type-safe check to ensure all cases are covered.
        const exhaustiveCheck: never = recoveryStrategy;
        return this.handleFatalError(error, context, `Unhandled recovery strategy: ${exhaustiveCheck}`);
    }
  }

  // --- Private Helper Methods: Strategy Handlers ---

  private async handleRetryStrategy(
    error: VerificationError,
    context: VerificationContext,
    strategy: RetryStrategy,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    const operationId = context.operationId;
    const currentAttempts = this.retryAttempts.get(operationId) || 0;

    if (currentAttempts >= strategy.maxRetries) {
      onProgress?.(context.currentProgress, `Retry limit reached for ${operationId}. Escalating to fallback.`);
      this.retryAttempts.delete(operationId); // Clean up
      return this.escalateToFallback(error, context, onProgress);
    }

    const nextAttempt = currentAttempts + 1;
    this.retryAttempts.set(operationId, nextAttempt);

    const delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier || 2, currentAttempts);
    onProgress?.(context.currentProgress, `Retrying operation ${operationId} (attempt ${nextAttempt}/${strategy.maxRetries}) after ${delay}ms...`);
    await this.delay(delay);

    try {
      // The actual operation that needs to be retried must be implemented
      // by the consumer of this class.
      const result = await this.retryOperation(context);
      this.retryAttempts.delete(operationId); // Success, so clear retry count
      return { success: true, result };
    } catch (retryError) {
      // If the retry fails, we recursively call the main handler.
      return this.handleVerificationError(retryError as VerificationError, context, onProgress);
    }
  }

  private async handleFallbackStrategy(
    error: VerificationError,
    context: VerificationContext,
    strategy: FallbackStrategy,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    onProgress?.(context.currentProgress, `Attempting fallback strategies...`);
    for (const fallback of strategy.alternatives) {
      try {
        onProgress?.(context.currentProgress, `Trying fallback: ${fallback.name}`);
        // The actual fallback logic must be implemented by the consumer.
        const result = await this.executeFallback(fallback, context);
        return {
          success: true,
          result,
          note: `Used fallback strategy: ${fallback.name}`,
        };
      } catch (fallbackError) {
        console.warn(`Fallback '${fallback.name}' failed:`, (fallbackError as Error).message);
        continue; // Try the next fallback
      }
    }

    // If all fallbacks fail, degrade gracefully.
    onProgress?.(context.currentProgress, 'All fallback strategies failed. Degrading gracefully.');
    return this.handleGracefulDegradation(error, context, {
      type: 'graceful_degradation',
      degradationLevel: 'partial_results',
    });
  }

  private async handleGracefulDegradation(
    error: VerificationError,
    context: VerificationContext,
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
        break; // Fall through if cache is empty
    }

    // If degradation is not possible (e.g., no partial results), treat as fatal.
    return this.handleFatalError(error, context, `Graceful degradation failed: ${strategy.degradationLevel}`);
  }

  private async handleSkipAndContinue(
    error: VerificationError,
    context: VerificationContext,
    strategy: SkipAndContinueStrategy
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

  private handleFatalError(error: VerificationError, context: VerificationContext, note?: string): Promise<RecoveryResult> {
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

  // --- Private Helper Methods: Classification and Strategy Selection ---

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

  private getRecoveryStrategy(errorType: ErrorType, context: VerificationContext): RecoveryStrategy {
    // This could be enhanced with dynamic strategies based on context
    const strategies: Record<ErrorType, RecoveryStrategy> = {
      rate_limit: {
        type: 'retry',
        maxRetries: 3,
        baseDelay: 60000, // 1 minute base delay for rate limits
        backoffMultiplier: 2,
      },
      network: {
        type: 'retry',
        maxRetries: 3,
        baseDelay: 2000,
        backoffMultiplier: 2,
      },
      ai_processing: {
        type: 'fallback',
        alternatives: [
          { name: 'simplified_prompt', method: 'useSimplifiedPrompt' },
          { name: 'different_model', method: 'useDifferentModel' },
        ],
      },
      input_validation: {
        type: 'skip_and_continue',
        skipStrategy: 'ignore_invalid_claims',
      },
      unknown: {
        type: 'graceful_degradation',
        degradationLevel: 'partial_results',
      },
    };
    return strategies[errorType];
  }

  // --- Private Helper Methods: Utilities and Placeholders ---

  private async escalateToFallback(
    error: VerificationError,
    context: VerificationContext,
    onProgress?: ProgressCallback
  ): Promise<RecoveryResult> {
    // When retries fail, we manually trigger the fallback strategy for 'network' or 'rate_limit' errors.
    const fallbackStrategy: FallbackStrategy = {
      type: 'fallback',
      alternatives: [{ name: 'use_cached_or_degraded', method: 'useCachedOrDegraded' }],
    };
    return this.handleFallbackStrategy(error, context, fallbackStrategy, onProgress);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- PLACEHOLDER METHODS ---
  // These methods must be implemented or overridden by the consumer of this class.

  /**
   * **[Placeholder]** This method should contain the logic to re-run the failed operation.
   * @param context The context of the operation to retry.
   * @returns The result of the successful operation.
   */
  protected async retryOperation(context: VerificationContext): Promise<VerificationResult> {
    console.log(`[Placeholder] Retrying operation: ${context.operationId}`);
    // To test the retry logic, simulate a persistent failure.
    // In a real implementation, this would call the actual verification service.
    return Promise.reject(new VerificationError('Simulated persistent failure during retry.'));
  }

  /**
   * **[Placeholder]** This method should execute a fallback alternative.
   * @param fallback The fallback strategy to execute.
   * @param context The context of the operation.
   * @returns The result from the successful fallback.
   */
  protected async executeFallback(fallback: FallbackAlternative, context: VerificationContext): Promise<VerificationResult> {
    console.log(`[Placeholder] Executing fallback: ${fallback.name}`);
    // Simulate failure for all but a specific fallback for testing purposes.
    if (fallback.method !== 'useCachedOrDegraded') {
        return Promise.reject(new VerificationError(`Simulated failure for fallback: ${fallback.name}`));
    }
    // In a real implementation, this would call a different service or use different parameters.
    return Promise.resolve({
        claim: 'Claim from fallback',
        verification_status: 'partially_verified',
        confidence_score: 50,
        evidence_summary: { supporting_evidence: [], contradicting_evidence: [], neutral_evidence: [] },
        source_analysis: { total_sources: 0, source_distribution: {} as any, credibility_distribution: { high: 0, medium: 0, low: 0 }, consensus_level: 0, contradiction_level: 0 },
        verification_methodology: ['fallback: ' + fallback.name],
        last_updated: new Date().toISOString(),
    });
  }

  /**
   * **[Placeholder]** This method should perform a simplified, lower-accuracy verification.
   * @param context The context of the operation.
   */
  protected async performSimplifiedVerification(context: VerificationContext): Promise<Partial<VerificationResult>> {
    console.log(`[Placeholder] Performing simplified verification for ${context.operationId}`);
    return {
      verification_status: 'partially_verified',
      confidence_score: 40, // Lower confidence
      warnings: ['Result generated using a reduced-accuracy method.'],
    };
  }

  /**
   * **[Placeholder]** This method should retrieve results from a cache.
   * @param context The context of the operation.
   */
  protected async getCachedResults(context: VerificationContext): Promise<VerificationResult | null> {
    console.log(`[Placeholder] Checking cache for ${context.operationId}`);
    // Return null to simulate a cache miss.
    return null;
  }
}
