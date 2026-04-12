import { ErrorLogger } from './ErrorLogger';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryManager {
  private config: RetryConfig;
  private logger: ErrorLogger;

  constructor(logger: ErrorLogger, config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.logger = logger;
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt);
          this.logger.info('retry', `Retry attempt ${attempt}/${this.config.maxRetries} for "${operationName}" after ${delay}ms`);
          await this.sleep(delay);
        }

        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warning(
          'retry',
          `Attempt ${attempt + 1}/${this.config.maxRetries + 1} failed for "${operationName}": ${lastError.message}`,
        );
      }
    }

    this.logger.error(
      'retry',
      `All ${this.config.maxRetries + 1} attempts exhausted for "${operationName}"`,
      operationName,
      { lastError: lastError?.message },
    );

    throw lastError!;
  }

  calculateDelay(attempt: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
