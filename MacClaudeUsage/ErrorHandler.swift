import { ErrorLogger } from './ErrorLogger';
import { RetryManager } from './RetryManager';
import { RecoveryActions, RecoveryResult, RecoveryCallbacks } from './RecoveryActions';

export type ErrorCategory = 'authentication' | 'network' | 'sync' | 'fetch' | 'system' | 'unknown';

export class FetchError extends Error {
  code: string;
  fetcherType: 'webapi' | 'cli';
  retryable: boolean;

  constructor(message: string, code: string, fetcherType: 'webapi' | 'cli', retryable: boolean = false) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    this.fetcherType = fetcherType;
    this.retryable = retryable;
  }
}

export class AuthError extends Error {
  code: string;
  requiresReauth: boolean;

  constructor(message: string, code: string, requiresReauth: boolean = false) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.requiresReauth = requiresReauth;
  }
}

export class SyncError extends Error {
  code: string;
  operation: string;

  constructor(message: string, code: string, operation: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.operation = operation;
  }
}

export class ErrorHandler {
  private logger: ErrorLogger;
  private retryManager: RetryManager;
  private recoveryActions: RecoveryActions;

  constructor(callbacks: RecoveryCallbacks = {}) {
    this.logger = new ErrorLogger();
    this.retryManager = new RetryManager(this.logger);
    this.recoveryActions = new RecoveryActions(this.logger, callbacks);
  }

  getLogger(): ErrorLogger {
    return this.logger;
  }

  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  getRecoveryActions(): RecoveryActions {
    return this.recoveryActions;
  }

  categorizeError(error: Error): ErrorCategory {
    if (error instanceof AuthError || error.name === 'AuthError') {
      return 'authentication';
    }
    if (error instanceof SyncError || error.name === 'SyncError') {
      return 'sync';
    }
    if (error instanceof FetchError || error.name === 'FetchError' || error.name === 'UsageFetchError') {
      return 'fetch';
    }
    if (error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      return 'network';
    }
    if (error.message.includes('EPERM') || error.message.includes('ENOENT') || error.message.includes('system')) {
      return 'system';
    }
    return 'unknown';
  }

  async handleError(error: Error, context: string): Promise<RecoveryResult> {
    const category = this.categorizeError(error);

    this.logger.error(category, error.message, context, {
      errorName: error.name,
      errorCode: (error as { code?: string }).code,
      category,
    });

    switch (category) {
      case 'authentication':
        return this.handleAuthError(error as AuthError);
      case 'fetch':
        return this.handleFetchError(error);
      case 'sync':
        return this.handleSyncError(error as SyncError);
      case 'network':
        return this.handleNetworkError(error, context);
      case 'system':
        return this.recoveryActions.gracefulDegradation(context, error.message);
      default:
        this.logger.warning('error-handler', `Unhandled error category "${category}" in context "${context}"`);
        return {
          action: 'none',
          success: false,
          message: `Unhandled error: ${error.message}`,
        };
    }
  }

  private async handleAuthError(error: AuthError): Promise<RecoveryResult> {
    if (error.requiresReauth) {
      return this.recoveryActions.triggerReauth();
    }
    return this.recoveryActions.gracefulDegradation('authentication', error.message);
  }

  private async handleFetchError(error: Error): Promise<RecoveryResult> {
    const fetchError = error as FetchError;
    if (fetchError.fetcherType === 'webapi') {
      return this.recoveryActions.handlePersistentWebAPIFailure();
    }
    return this.recoveryActions.gracefulDegradation('fetcher', error.message);
  }

  private async handleSyncError(error: SyncError): Promise<RecoveryResult> {
    return this.recoveryActions.retrySync();
  }

  private async handleNetworkError(error: Error, context: string): Promise<RecoveryResult> {
    return this.recoveryActions.gracefulDegradation(context, `Network error: ${error.message}`);
  }
}
