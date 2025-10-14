interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface RequestConfig extends RequestInit {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
}

export class RobustHttpClient {
  private static instance: RobustHttpClient;
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  static getInstance(): RobustHttpClient {
    if (!RobustHttpClient.instance) {
      RobustHttpClient.instance = new RobustHttpClient();
    }
    return RobustHttpClient.instance;
  }

  async request<T>(url: string, config: RequestConfig = {}): Promise<T> {
    const { timeout = 30000, retryConfig = {}, ...fetchConfig } = config;
    const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };

    let lastError: Error = new Error('Request failed without a specific error');

    for (let attempt = 0; attempt <= finalRetryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchConfig,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        lastError = error as Error;

        if (attempt === finalRetryConfig.maxRetries) {
          break;
        }

        // Don't retry certain errors
        if (error instanceof Error) {
          if (error.message.includes('401') || error.message.includes('403')) {
            throw new Error(`Authentication failed: ${error.message}`);
          }
        }

        // Calculate delay for next attempt
        const delay = Math.min(
          finalRetryConfig.initialDelay * Math.pow(finalRetryConfig.backoffMultiplier, attempt),
          finalRetryConfig.maxDelay
        );

        console.warn(`Request failed (attempt ${attempt + 1}/${finalRetryConfig.maxRetries + 1}), retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }

    throw new Error(`Request failed after ${finalRetryConfig.maxRetries + 1} attempts: ${lastError.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}