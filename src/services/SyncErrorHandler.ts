import { SyncError } from '../types/sync';
import { RetryConfig } from '../types/retry';
import { CircuitBreakerState } from '../types/circuit';

export enum SyncErrorCode {
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ACCOUNT_UNAVAILABLE = 'ACCOUNT_UNAVAILABLE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 100,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

const DEFAULT_COOLDOWN_PERIOD = 60000;
const CIRCUIT_BREAKER_THRESHOLD = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyError(error: unknown): SyncErrorCode {
  if (error instanceof SyncError) {
    switch (error.code) {
      case 'ICLOUD_UNAVAILABLE':
      case 'NETWORK_UNAVAILABLE':
        return SyncErrorCode.NETWORK_UNAVAILABLE;
      case 'QUOTA_EXCEEDED':
        return SyncErrorCode.QUOTA_EXCEEDED;
      case 'ACCOUNT_UNAVAILABLE':
        return SyncErrorCode.ACCOUNT_UNAVAILABLE;
      case 'SERVICE_UNAVAILABLE':
      default:
        return SyncErrorCode.SERVICE_UNAVAILABLE;
    }
  }
  return SyncErrorCode.SERVICE_UNAVAILABLE;
}

function getUserMessage(code: SyncErrorCode): string {
  switch (code) {
    case SyncErrorCode.NETWORK_UNAVAILABLE:
      return 'iCloud sync is unavailable due to network issues. Your data is safe locally and will sync when connectivity is restored.';
    case SyncErrorCode.QUOTA_EXCEEDED:
      return 'iCloud storage is full. Please free up space to resume syncing.';
    case SyncErrorCode.ACCOUNT_UNAVAILABLE:
      return 'iCloud account is not available. Please check your iCloud settings.';
    case SyncErrorCode.SERVICE_UNAVAILABLE:
      return 'iCloud service is temporarily unavailable. Sync will resume automatically.';
  }
}

export class SyncErrorHandler {
  private circuitBreakerState: CircuitBreakerState;
  private iCloudAvailabilityChecker: () => Promise<boolean>;

  constructor(
    iCloudAvailabilityChecker?: () => Promise<boolean>,
    cooldownPeriod: number = DEFAULT_COOLDOWN_PERIOD
  ) {
    this.circuitBreakerState = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: new Date(0),
      cooldownPeriod,
    };
    this.iCloudAvailabilityChecker =
      iCloudAvailabilityChecker ?? (() => Promise.resolve(true));
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreakerState };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    if (this.circuitBreakerState.isOpen) {
      const elapsed =
        Date.now() - this.circuitBreakerState.lastFailureTime.getTime();
      if (elapsed < this.circuitBreakerState.cooldownPeriod) {
        throw new SyncError(
          'Circuit breaker is open — operations are temporarily blocked',
          'SERVICE_UNAVAILABLE',
          'executeWithRetry',
          true
        );
      }
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        this.resetCircuitBreaker();
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof SyncError && !error.recoverable) {
          throw error;
        }

        if (attempt < config.maxAttempts) {
          const delay = Math.min(
            config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
            config.maxDelay
          );
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  handleSyncError(error: unknown): {
    code: SyncErrorCode;
    message: string;
    recoverable: boolean;
  } {
    const code = classifyError(error);
    const message = getUserMessage(code);
    const recoverable =
      error instanceof SyncError ? error.recoverable : false;

    this.circuitBreakerState.failureCount += 1;
    this.circuitBreakerState.lastFailureTime = new Date();

    if (this.circuitBreakerState.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerState.isOpen = true;
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.warn(
      `[SyncErrorHandler] ${code}: ${errorMessage} (failure #${this.circuitBreakerState.failureCount})`
    );

    return { code, message, recoverable };
  }

  async attemptRecovery(): Promise<boolean> {
    try {
      const isAvailable = await this.iCloudAvailabilityChecker();
      if (isAvailable) {
        this.resetCircuitBreaker();
        console.log('[SyncErrorHandler] Recovery successful — circuit breaker reset');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerState.isOpen = false;
    this.circuitBreakerState.failureCount = 0;
  }
}
