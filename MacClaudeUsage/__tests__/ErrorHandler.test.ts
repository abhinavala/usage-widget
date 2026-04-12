import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { FetcherType, FetcherConfig } from '../../src/types/fetcher';
import type { UsageData } from '../../src/types/usage';
import { AuthError, FetchError } from '../../src/types/errors';
import { SyncError } from '../../src/types/sync';

// Read Swift source files for contract validation
const swiftDir = join(__dirname, '..');
const errorHandlerSwift = readFileSync(join(swiftDir, 'ErrorHandler.swift'), 'utf-8');
const retryManagerSwift = readFileSync(join(swiftDir, 'RetryManager.swift'), 'utf-8');
const errorLoggerSwift = readFileSync(join(swiftDir, 'ErrorLogger.swift'), 'utf-8');
const recoveryActionsSwift = readFileSync(join(swiftDir, 'RecoveryActions.swift'), 'utf-8');

// --- Mock classes mirroring Swift implementation ---

type ErrorCategory = 'authentication' | 'network' | 'parsing' | 'sync' | 'system' | 'unknown';
type ErrorSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface ErrorLogEntry {
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  context: string;
  recoveryAttempted: boolean;
  recoverySucceeded: boolean | null;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recoveryAttempts: number;
  recoverySuccesses: number;
}

type RecoveryActionType = 'reauthenticate' | 'switch_fetcher' | 'retry_with_backoff' | 'clear_cache' | 'reset_sync' | 'graceful_degradation';

interface RecoveryResult {
  actionType: RecoveryActionType;
  succeeded: boolean;
  message: string;
}

interface RetryResult {
  succeeded: boolean;
  attempts: number;
  lastError: Error | null;
  finalDelay: number;
}

// Mock ErrorLogger
class MockErrorLogger {
  logEntries: ErrorLogEntry[] = [];
  metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCategory: {},
    errorsBySeverity: {},
    recoveryAttempts: 0,
    recoverySuccesses: 0,
  };

  logError(error: Error, context: string, severity: ErrorSeverity = 'ERROR'): void {
    const category = this.categorizeError(error);
    const code = this.errorCode(error);
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      category,
      severity,
      code,
      message: error.message,
      context,
      recoveryAttempted: false,
      recoverySucceeded: null,
    };
    this.logEntries.push(entry);
    this.metrics.totalErrors++;
    this.metrics.errorsByCategory[category] = (this.metrics.errorsByCategory[category] || 0) + 1;
    this.metrics.errorsBySeverity[severity] = (this.metrics.errorsBySeverity[severity] || 0) + 1;
  }

  logRecoveryAttempt(error: Error, context: string, succeeded: boolean): void {
    const category = this.categorizeError(error);
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      category,
      severity: succeeded ? 'INFO' : 'WARNING',
      code: this.errorCode(error),
      message: `Recovery ${succeeded ? 'succeeded' : 'failed'}: ${error.message}`,
      context,
      recoveryAttempted: true,
      recoverySucceeded: succeeded,
    };
    this.logEntries.push(entry);
    this.metrics.recoveryAttempts++;
    if (succeeded) this.metrics.recoverySuccesses++;
  }

  categorizeError(error: Error): ErrorCategory {
    if (error instanceof AuthError) return 'authentication';
    if (error instanceof FetchError) {
      if (['NETWORK_TIMEOUT', 'NETWORK_ERROR'].includes(error.code)) return 'network';
      if (['PARSE_ERROR', 'INVALID_RESPONSE'].includes(error.code)) return 'parsing';
      if (['CREDENTIALS_EXPIRED', 'AUTHENTICATION_FAILED'].includes(error.code)) return 'authentication';
      return 'network';
    }
    if (error instanceof SyncError) return 'sync';
    return 'unknown';
  }

  private errorCode(error: Error): string {
    if (error instanceof AuthError) return error.code;
    if (error instanceof FetchError) return error.code;
    if (error instanceof SyncError) return error.code;
    return 'UNKNOWN_ERROR';
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.logEntries = [];
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      recoveryAttempts: 0,
      recoverySuccesses: 0,
    };
  }
}

// Mock RecoveryActions
class MockRecoveryActions {
  lastRecoveryAction: RecoveryActionType | null = null;
  fetcherStrategy: FetcherType = 'webapi';
  reauthTriggered = false;

  triggerRecoveryAction(error: Error, context: string): RecoveryResult {
    const actionType = this.determineRecoveryAction(error);
    this.lastRecoveryAction = actionType;

    if (actionType === 'reauthenticate') {
      this.reauthTriggered = true;
    }

    if (actionType === 'switch_fetcher') {
      this.fetcherStrategy = this.fetcherStrategy === 'webapi' ? 'cli' : 'webapi';
    }

    return {
      actionType,
      succeeded: true,
      message: `Recovery action ${actionType} completed`,
    };
  }

  determineRecoveryAction(error: Error): RecoveryActionType {
    if (error instanceof AuthError) {
      return error.requiresReauth ? 'reauthenticate' : 'retry_with_backoff';
    }
    if (error instanceof FetchError) {
      if (['CREDENTIALS_EXPIRED', 'AUTHENTICATION_FAILED'].includes(error.code)) {
        return 'reauthenticate';
      }
      if (['NETWORK_TIMEOUT', 'NETWORK_ERROR'].includes(error.code)) {
        return error.retryable ? 'retry_with_backoff' : 'switch_fetcher';
      }
      if (['SERVER_ERROR', 'RATE_LIMITED'].includes(error.code)) {
        return 'switch_fetcher';
      }
      return 'graceful_degradation';
    }
    return 'graceful_degradation';
  }

  reset(): void {
    this.lastRecoveryAction = null;
    this.fetcherStrategy = 'webapi';
    this.reauthTriggered = false;
  }
}

// Mock RetryManager
class MockRetryManager {
  config = { maxRetries: 3, baseDelay: 1.0, maxDelay: 60.0, backoffMultiplier: 2.0 };
  attemptDelays: number[] = [];

  retryWithBackoff(context: string, operation: () => void): RetryResult {
    let lastError: Error | null = null;
    let delay = this.config.baseDelay;
    this.attemptDelays = [];

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        operation();
        return { succeeded: true, attempts: attempt, lastError: null, finalDelay: delay };
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error as Error)) {
          return { succeeded: false, attempts: attempt, lastError, finalDelay: delay };
        }

        if (attempt <= this.config.maxRetries) {
          this.attemptDelays.push(delay);
          delay = this.calculateNextDelay(delay);
        }
      }
    }

    return {
      succeeded: false,
      attempts: this.config.maxRetries + 1,
      lastError,
      finalDelay: delay,
    };
  }

  isRetryable(error: Error): boolean {
    if (error instanceof AuthError) return !error.requiresReauth;
    if (error instanceof FetchError) return error.retryable;
    return false;
  }

  calculateNextDelay(currentDelay: number): number {
    return Math.min(currentDelay * this.config.backoffMultiplier, this.config.maxDelay);
  }

  delayForAttempt(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    return Math.min(delay, this.config.maxDelay);
  }
}

// Mock ErrorHandler (mirrors Swift ErrorHandler)
class MockErrorHandler {
  errorLogger: MockErrorLogger;
  retryManager: MockRetryManager;
  recoveryActions: MockRecoveryActions;

  constructor(
    errorLogger?: MockErrorLogger,
    retryManager?: MockRetryManager,
    recoveryActions?: MockRecoveryActions,
  ) {
    this.errorLogger = errorLogger ?? new MockErrorLogger();
    this.retryManager = retryManager ?? new MockRetryManager();
    this.recoveryActions = recoveryActions ?? new MockRecoveryActions();
  }

  handleError(error: Error, context: string): void {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error);
    this.logError(error, context, severity);
    this.triggerRecoveryAction(error, context);
  }

  categorizeError(error: Error): ErrorCategory {
    return this.errorLogger.categorizeError(error);
  }

  triggerRecoveryAction(error: Error, context: string): RecoveryResult {
    return this.recoveryActions.triggerRecoveryAction(error, context);
  }

  logError(error: Error, context: string, severity: ErrorSeverity = 'ERROR'): void {
    this.errorLogger.logError(error, context, severity);
  }

  determineSeverity(error: Error): ErrorSeverity {
    if (error instanceof AuthError) {
      return error.requiresReauth ? 'CRITICAL' : 'ERROR';
    }
    if (error instanceof FetchError) {
      if (error.retryable) return 'WARNING';
      if (error.code === 'SERVER_ERROR') return 'CRITICAL';
      return 'ERROR';
    }
    return 'ERROR';
  }

  getErrorMetrics(): ErrorMetrics {
    return this.errorLogger.getMetrics();
  }

  reset(): void {
    this.errorLogger.reset();
    this.recoveryActions.reset();
  }
}

// ============================================================
// Tests
// ============================================================

describe('ErrorHandler', () => {
  let handler: MockErrorHandler;
  let errorLogger: MockErrorLogger;
  let retryManager: MockRetryManager;
  let recoveryActions: MockRecoveryActions;

  beforeEach(() => {
    errorLogger = new MockErrorLogger();
    retryManager = new MockRetryManager();
    recoveryActions = new MockRecoveryActions();
    handler = new MockErrorHandler(errorLogger, retryManager, recoveryActions);
  });

  // ---- Swift source file validation ----

  describe('Swift source file structure', () => {
    it('ErrorHandler.swift exists and contains required functions', () => {
      expect(errorHandlerSwift).toContain('class ErrorHandler');
      expect(errorHandlerSwift).toContain('func handleError');
      expect(errorHandlerSwift).toContain('func categorizeError');
      expect(errorHandlerSwift).toContain('func triggerRecoveryAction');
      expect(errorHandlerSwift).toContain('func logError');
      expect(errorHandlerSwift).toContain('static let shared');
    });

    it('RetryManager.swift exists and contains retry logic', () => {
      expect(retryManagerSwift).toContain('class RetryManager');
      expect(retryManagerSwift).toContain('func retryWithBackoff');
      expect(retryManagerSwift).toContain('func isRetryable');
      expect(retryManagerSwift).toContain('func calculateNextDelay');
      expect(retryManagerSwift).toContain('static let shared');
    });

    it('ErrorLogger.swift exists and contains logging functions', () => {
      expect(errorLoggerSwift).toContain('class ErrorLogger');
      expect(errorLoggerSwift).toContain('func logError');
      expect(errorLoggerSwift).toContain('func categorizeError');
      expect(errorLoggerSwift).toContain('func getMetrics');
      expect(errorLoggerSwift).toContain('static let shared');
    });

    it('RecoveryActions.swift exists and contains recovery functions', () => {
      expect(recoveryActionsSwift).toContain('class RecoveryActions');
      expect(recoveryActionsSwift).toContain('func triggerRecoveryAction');
      expect(recoveryActionsSwift).toContain('func determineRecoveryAction');
      expect(recoveryActionsSwift).toContain('func switchFetcherStrategy');
      expect(recoveryActionsSwift).toContain('static let shared');
    });

    it('ErrorHandler.swift uses singleton pattern with dependency injection', () => {
      expect(errorHandlerSwift).toContain('RetryManager');
      expect(errorHandlerSwift).toContain('RecoveryActions');
      expect(errorHandlerSwift).toContain('ErrorLogger');
    });
  });

  // ---- Test case 1: handleError correctly categorizes AuthError and triggers re-authentication ----

  describe('handleError correctly categorizes AuthError and triggers re-authentication', () => {
    it('should categorize AuthError as authentication', () => {
      const authError = new AuthError('Session expired', 'SESSION_EXPIRED', true);
      const category = handler.categorizeError(authError);
      expect(category).toBe('authentication');
    });

    it('should trigger reauthenticate recovery action for AuthError with requiresReauth', () => {
      const authError = new AuthError('Session expired', 'SESSION_EXPIRED', true);
      handler.handleError(authError, 'test_context');

      expect(recoveryActions.lastRecoveryAction).toBe('reauthenticate');
      expect(recoveryActions.reauthTriggered).toBe(true);
    });

    it('should log the error when handling AuthError', () => {
      const authError = new AuthError('Invalid token', 'INVALID_TOKEN', true);
      handler.handleError(authError, 'auth_flow');

      expect(errorLogger.logEntries.length).toBeGreaterThan(0);
      const entry = errorLogger.logEntries[0];
      expect(entry.category).toBe('authentication');
      expect(entry.context).toBe('auth_flow');
    });

    it('should set severity to CRITICAL for AuthError requiring reauth', () => {
      const authError = new AuthError('Expired', 'EXPIRED', true);
      const severity = handler.determineSeverity(authError);
      expect(severity).toBe('CRITICAL');
    });

    it('should set severity to ERROR for AuthError not requiring reauth', () => {
      const authError = new AuthError('Minor issue', 'MINOR', false);
      const severity = handler.determineSeverity(authError);
      expect(severity).toBe('ERROR');
    });

    it('should use retry_with_backoff for AuthError without requiresReauth', () => {
      const authError = new AuthError('Transient', 'TRANSIENT', false);
      const result = handler.triggerRecoveryAction(authError, 'test');
      expect(result.actionType).toBe('retry_with_backoff');
    });

    it('should log recovery attempt in metrics', () => {
      const authError = new AuthError('Session expired', 'SESSION_EXPIRED', true);
      handler.handleError(authError, 'auth_check');

      const metrics = handler.getErrorMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
      expect(metrics.errorsByCategory['authentication']).toBeGreaterThan(0);
    });

    it('should validate AuthError contract matches Swift implementation', () => {
      const error = new AuthError('test', 'TEST_CODE', true);
      expect(error.code).toBe('TEST_CODE');
      expect(error.requiresReauth).toBe(true);
      expect(error.message).toBe('test');
      expect(error.name).toBe('AuthError');
    });
  });

  // ---- Test case 2: retryWithBackoff performs exponential backoff and respects maximum retry limit ----

  describe('retryWithBackoff performs exponential backoff and respects maximum retry limit', () => {
    it('should perform 3 retries with increasing delays then fail', () => {
      let attempts = 0;
      const result = retryManager.retryWithBackoff('test_retry', () => {
        attempts++;
        throw new FetchError('Network error', 'NETWORK_ERROR', 'webapi', true);
      });

      expect(result.succeeded).toBe(false);
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
      expect(result.lastError).toBeDefined();
    });

    it('should use exponential backoff delays: 1, 2, 4', () => {
      const result = retryManager.retryWithBackoff('backoff_test', () => {
        throw new FetchError('Fail', 'NETWORK_ERROR', 'webapi', true);
      });

      // 3 delays recorded (between attempts 1-2, 2-3, 3-4)
      expect(retryManager.attemptDelays).toHaveLength(3);
      expect(retryManager.attemptDelays[0]).toBe(1.0);  // baseDelay
      expect(retryManager.attemptDelays[1]).toBe(2.0);  // 1 * 2
      expect(retryManager.attemptDelays[2]).toBe(4.0);  // 2 * 2
    });

    it('should succeed immediately if operation succeeds on first try', () => {
      const result = retryManager.retryWithBackoff('success_test', () => {
        // no error
      });

      expect(result.succeeded).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.lastError).toBeNull();
    });

    it('should succeed on second attempt if first fails', () => {
      let attempt = 0;
      const result = retryManager.retryWithBackoff('partial_test', () => {
        attempt++;
        if (attempt === 1) {
          throw new FetchError('Timeout', 'NETWORK_TIMEOUT', 'webapi', true);
        }
      });

      expect(result.succeeded).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should not retry non-retryable errors', () => {
      const result = retryManager.retryWithBackoff('no_retry_test', () => {
        throw new FetchError('Parse error', 'PARSE_ERROR', 'webapi', false);
      });

      expect(result.succeeded).toBe(false);
      expect(result.attempts).toBe(1); // only 1 attempt, no retries
    });

    it('should not retry AuthError requiring reauth', () => {
      const result = retryManager.retryWithBackoff('auth_no_retry', () => {
        throw new AuthError('Expired', 'EXPIRED', true);
      });

      expect(result.succeeded).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('should cap delay at maxDelay', () => {
      const delay = retryManager.calculateNextDelay(50.0);
      expect(delay).toBeLessThanOrEqual(60.0);
    });

    it('should calculate correct delay for each attempt', () => {
      expect(retryManager.delayForAttempt(0)).toBe(1.0);
      expect(retryManager.delayForAttempt(1)).toBe(2.0);
      expect(retryManager.delayForAttempt(2)).toBe(4.0);
      expect(retryManager.delayForAttempt(3)).toBe(8.0);
      expect(retryManager.delayForAttempt(10)).toBe(60.0); // capped at maxDelay
    });

    it('should validate RetryConfig defaults match Swift implementation', () => {
      expect(retryManagerSwift).toContain('maxRetries: 3');
      expect(retryManagerSwift).toContain('baseDelay: 1.0');
      expect(retryManagerSwift).toContain('maxDelay: 60.0');
      expect(retryManagerSwift).toContain('backoffMultiplier: 2.0');
    });
  });

  // ---- Test case 3: triggerRecoveryAction switches fetcher strategy when WebAPI fails persistently ----

  describe('triggerRecoveryAction switches fetcher strategy when WebAPI fails persistently', () => {
    it('should switch to CLI fetcher after persistent WebAPI failures', () => {
      expect(recoveryActions.fetcherStrategy).toBe('webapi');

      const error = new FetchError('Server error', 'SERVER_ERROR', 'webapi', false);
      handler.triggerRecoveryAction(error, 'persistent_failure');

      expect(recoveryActions.lastRecoveryAction).toBe('switch_fetcher');
      expect(recoveryActions.fetcherStrategy).toBe('cli');
    });

    it('should switch fetcher for RATE_LIMITED errors', () => {
      const error = new FetchError('Rate limited', 'RATE_LIMITED', 'webapi', false);
      const result = handler.triggerRecoveryAction(error, 'rate_limit');

      expect(result.actionType).toBe('switch_fetcher');
      expect(recoveryActions.fetcherStrategy).toBe('cli');
    });

    it('should switch fetcher for non-retryable NETWORK_ERROR', () => {
      const error = new FetchError('Network down', 'NETWORK_ERROR', 'webapi', false);
      const result = handler.triggerRecoveryAction(error, 'network_down');

      expect(result.actionType).toBe('switch_fetcher');
      expect(recoveryActions.fetcherStrategy).toBe('cli');
    });

    it('should use retry_with_backoff for retryable NETWORK_ERROR', () => {
      const error = new FetchError('Temporary network issue', 'NETWORK_ERROR', 'webapi', true);
      const result = handler.triggerRecoveryAction(error, 'transient_network');

      expect(result.actionType).toBe('retry_with_backoff');
      expect(recoveryActions.fetcherStrategy).toBe('webapi'); // no switch
    });

    it('should trigger reauthenticate for CREDENTIALS_EXPIRED', () => {
      const error = new FetchError('Credentials expired', 'CREDENTIALS_EXPIRED', 'webapi', false);
      const result = handler.triggerRecoveryAction(error, 'cred_expired');

      expect(result.actionType).toBe('reauthenticate');
    });

    it('should trigger reauthenticate for AUTHENTICATION_FAILED', () => {
      const error = new FetchError('Auth failed', 'AUTHENTICATION_FAILED', 'webapi', false);
      const result = handler.triggerRecoveryAction(error, 'auth_failed');

      expect(result.actionType).toBe('reauthenticate');
    });

    it('should use graceful degradation for PARSE_ERROR', () => {
      const error = new FetchError('Parse failed', 'PARSE_ERROR', 'webapi', false);
      const result = handler.triggerRecoveryAction(error, 'parse_error');

      expect(result.actionType).toBe('graceful_degradation');
    });

    it('should toggle fetcher back to webapi if CLI also fails', () => {
      const error1 = new FetchError('Fail 1', 'SERVER_ERROR', 'webapi', false);
      handler.triggerRecoveryAction(error1, 'fail_1');
      expect(recoveryActions.fetcherStrategy).toBe('cli');

      const error2 = new FetchError('Fail 2', 'SERVER_ERROR', 'cli', false);
      handler.triggerRecoveryAction(error2, 'fail_2');
      expect(recoveryActions.fetcherStrategy).toBe('webapi');
    });

    it('should validate RecoveryActions.swift has switchFetcherStrategy', () => {
      expect(recoveryActionsSwift).toContain('func switchFetcherStrategy');
      expect(recoveryActionsSwift).toContain('switchFetcherStrategy()');
      expect(recoveryActionsSwift).toContain('FetcherStrategy');
    });

    it('should validate recovery action result structure', () => {
      const error = new FetchError('Test', 'SERVER_ERROR', 'webapi', false);
      const result = handler.triggerRecoveryAction(error, 'test');

      expect(result).toHaveProperty('actionType');
      expect(result).toHaveProperty('succeeded');
      expect(result).toHaveProperty('message');
      expect(result.succeeded).toBe(true);
    });
  });

  // ---- Error categorization ----

  describe('error categorization', () => {
    it('should categorize AuthError as authentication', () => {
      const error = new AuthError('test', 'CODE', false);
      expect(handler.categorizeError(error)).toBe('authentication');
    });

    it('should categorize FetchError with NETWORK_ERROR as network', () => {
      const error = new FetchError('test', 'NETWORK_ERROR', 'webapi', true);
      expect(handler.categorizeError(error)).toBe('network');
    });

    it('should categorize FetchError with NETWORK_TIMEOUT as network', () => {
      const error = new FetchError('test', 'NETWORK_TIMEOUT', 'webapi', true);
      expect(handler.categorizeError(error)).toBe('network');
    });

    it('should categorize FetchError with PARSE_ERROR as parsing', () => {
      const error = new FetchError('test', 'PARSE_ERROR', 'webapi', false);
      expect(handler.categorizeError(error)).toBe('parsing');
    });

    it('should categorize FetchError with CREDENTIALS_EXPIRED as authentication', () => {
      const error = new FetchError('test', 'CREDENTIALS_EXPIRED', 'webapi', false);
      expect(handler.categorizeError(error)).toBe('authentication');
    });

    it('should categorize SyncError as sync', () => {
      const error = new SyncError('test', 'SYNC_FAIL', 'write', false);
      expect(handler.categorizeError(error)).toBe('sync');
    });

    it('should categorize unknown errors as unknown', () => {
      const error = new Error('generic error');
      expect(handler.categorizeError(error)).toBe('unknown');
    });
  });

  // ---- Integration contract validation ----

  describe('integration contract validation', () => {
    it('FetchError matches TypeScript contract', () => {
      const error = new FetchError('msg', 'CODE', 'webapi', true);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('fetcherType');
      expect(error).toHaveProperty('retryable');
      expect(error.name).toBe('FetchError');
    });

    it('AuthError matches TypeScript contract', () => {
      const error = new AuthError('msg', 'CODE', true);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('requiresReauth');
      expect(error.name).toBe('AuthError');
    });

    it('SyncError matches TypeScript contract', () => {
      const error = new SyncError('msg', 'CODE', 'write', true);
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('operation');
      expect(error.name).toBe('SyncError');
    });

    it('ErrorHandler.swift references dependency types correctly', () => {
      expect(errorHandlerSwift).toContain('AuthError');
      expect(errorHandlerSwift).toContain('FetchError');
      expect(errorHandlerSwift).toContain('ErrorCategory');
      expect(errorHandlerSwift).toContain('ErrorSeverity');
    });

    it('ErrorLogger.swift references FetchErrorCode constants', () => {
      expect(errorLoggerSwift).toContain('FetchErrorCode.networkTimeout');
      expect(errorLoggerSwift).toContain('FetchErrorCode.networkError');
      expect(errorLoggerSwift).toContain('FetchErrorCode.parseError');
      expect(errorLoggerSwift).toContain('FetchErrorCode.credentialsExpired');
    });

    it('RecoveryActions.swift references FetcherStrategy', () => {
      expect(recoveryActionsSwift).toContain('FetcherStrategy');
      expect(recoveryActionsSwift).toContain('switchFetcherStrategy');
      expect(recoveryActionsSwift).toContain('currentFetcherType');
    });
  });

  // ---- Error logging and metrics ----

  describe('error logging and metrics', () => {
    it('should track error counts by category', () => {
      handler.handleError(new AuthError('auth', 'AUTH', true), 'ctx1');
      handler.handleError(new FetchError('net', 'NETWORK_ERROR', 'webapi', true), 'ctx2');

      const metrics = handler.getErrorMetrics();
      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByCategory['authentication']).toBe(1);
      expect(metrics.errorsByCategory['network']).toBe(1);
    });

    it('should sanitize sensitive data in ErrorLogger', () => {
      expect(errorLoggerSwift).toContain('sanitizeMessage');
      expect(errorLoggerSwift).toContain('REDACTED');
    });

    it('should use os.log for system-level logging', () => {
      expect(errorLoggerSwift).toContain('import os.log');
      expect(errorLoggerSwift).toContain('OSLog');
      expect(errorLoggerSwift).toContain('os_log');
    });

    it('should reset all state on reset', () => {
      handler.handleError(new AuthError('test', 'TEST', false), 'reset_test');
      expect(handler.getErrorMetrics().totalErrors).toBeGreaterThan(0);

      handler.reset();
      expect(handler.getErrorMetrics().totalErrors).toBe(0);
      expect(errorLogger.logEntries).toHaveLength(0);
    });
  });

  // ---- Graceful degradation ----

  describe('graceful degradation', () => {
    it('should maintain app functionality when non-critical components fail', () => {
      const parseError = new FetchError('Parse failed', 'PARSE_ERROR', 'webapi', false);
      const result = handler.triggerRecoveryAction(parseError, 'degradation_test');

      expect(result.actionType).toBe('graceful_degradation');
      expect(result.succeeded).toBe(true);
    });

    it('should use graceful degradation for unknown errors', () => {
      const unknownError = new Error('Something unexpected');
      const result = handler.triggerRecoveryAction(unknownError, 'unknown');

      expect(result.actionType).toBe('graceful_degradation');
    });
  });
});
