import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler, AuthError, FetchError, SyncError } from '../ErrorHandler';
import { RetryManager } from '../RetryManager';
import { ErrorLogger } from '../ErrorLogger';
import { RecoveryActions } from '../RecoveryActions';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let switchFetcherCallback: ReturnType<typeof vi.fn>;
  let reauthCallback: ReturnType<typeof vi.fn>;
  let retrySyncCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    switchFetcherCallback = vi.fn();
    reauthCallback = vi.fn();
    retrySyncCallback = vi.fn();

    errorHandler = new ErrorHandler({
      onSwitchFetcher: switchFetcherCallback,
      onTriggerReauth: reauthCallback,
      onRetrySync: retrySyncCallback,
    });
  });

  describe('categorizeError', () => {
    it('should categorize AuthError as authentication', () => {
      const error = new AuthError('auth failed', 'AUTH_FAILED', true);
      expect(errorHandler.categorizeError(error)).toBe('authentication');
    });

    it('should categorize SyncError as sync', () => {
      const error = new SyncError('sync failed', 'SYNC_FAILED', 'write');
      expect(errorHandler.categorizeError(error)).toBe('sync');
    });

    it('should categorize FetchError as fetch', () => {
      const error = new FetchError('fetch failed', 'FETCH_FAILED', 'webapi', true);
      expect(errorHandler.categorizeError(error)).toBe('fetch');
    });

    it('should categorize network-related errors as network', () => {
      const error = new Error('network connection refused');
      expect(errorHandler.categorizeError(error)).toBe('network');
    });

    it('should categorize system errors as system', () => {
      const error = new Error('EPERM: operation not permitted');
      expect(errorHandler.categorizeError(error)).toBe('system');
    });

    it('should categorize unknown errors as unknown', () => {
      const error = new Error('something went wrong');
      expect(errorHandler.categorizeError(error)).toBe('unknown');
    });
  });

  describe('handleError', () => {
    it('should correctly categorize AuthError and trigger re-authentication', async () => {
      const error = new AuthError('session expired', 'SESSION_EXPIRED', true);
      const result = await errorHandler.handleError(error, 'login');

      expect(result.action).toBe('trigger_reauth');
      expect(result.success).toBe(true);
      expect(reauthCallback).toHaveBeenCalled();
    });

    it('should handle AuthError without reauth as graceful degradation', async () => {
      const error = new AuthError('rate limited', 'RATE_LIMITED', false);
      const result = await errorHandler.handleError(error, 'login');

      expect(result.action).toBe('graceful_degradation');
      expect(result.success).toBe(true);
    });

    it('should handle SyncError by retrying sync', async () => {
      const error = new SyncError('sync conflict', 'CONFLICT', 'write');
      const result = await errorHandler.handleError(error, 'icloud-sync');

      expect(result.action).toBe('retry_sync');
      expect(result.success).toBe(true);
      expect(retrySyncCallback).toHaveBeenCalled();
    });

    it('should handle FetchError from webapi by tracking failures', async () => {
      const error = new FetchError('request failed', 'HTTP_500', 'webapi', true);
      const result = await errorHandler.handleError(error, 'usage-fetch');

      expect(result.action).toBe('none');
      expect(result.success).toBe(true);
    });

    it('should handle network errors with graceful degradation', async () => {
      const error = new Error('network timeout');
      const result = await errorHandler.handleError(error, 'api-call');

      expect(result.action).toBe('graceful_degradation');
      expect(result.success).toBe(true);
    });

    it('should handle system errors with graceful degradation', async () => {
      const error = new Error('ENOENT: file not found');
      const result = await errorHandler.handleError(error, 'file-read');

      expect(result.action).toBe('graceful_degradation');
      expect(result.success).toBe(true);
    });

    it('should handle unknown errors', async () => {
      const error = new Error('something unexpected');
      const result = await errorHandler.handleError(error, 'unknown-context');

      expect(result.action).toBe('none');
      expect(result.success).toBe(false);
    });

    it('should log errors when handling them', async () => {
      const error = new AuthError('test', 'TEST', true);
      await errorHandler.handleError(error, 'test-context');

      const logs = errorHandler.getLogger().getLogsByLevel('error');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].category).toBe('authentication');
    });
  });
});

describe('RetryManager', () => {
  let logger: ErrorLogger;
  let retryManager: RetryManager;

  beforeEach(() => {
    logger = new ErrorLogger();
    retryManager = new RetryManager(logger, {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });
  });

  describe('retryWithBackoff', () => {
    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await retryManager.retryWithBackoff(operation, 'test-op');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed eventually', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retryManager.retryWithBackoff(operation, 'test-op');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should perform exponential backoff and respect maximum retry limit', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(
        retryManager.retryWithBackoff(operation, 'test-op'),
      ).rejects.toThrow('always fails');

      // 1 initial + 3 retries = 4 total calls
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should log retry attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('ok');

      await retryManager.retryWithBackoff(operation, 'logged-op');

      const logs = logger.getLogsByCategory('retry');
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential delays', () => {
      expect(retryManager.calculateDelay(1)).toBe(10);   // 10 * 2^0
      expect(retryManager.calculateDelay(2)).toBe(20);   // 10 * 2^1
      expect(retryManager.calculateDelay(3)).toBe(40);   // 10 * 2^2
    });

    it('should cap delay at maxDelayMs', () => {
      expect(retryManager.calculateDelay(100)).toBe(1000);
    });
  });
});

describe('RecoveryActions', () => {
  let logger: ErrorLogger;
  let recoveryActions: RecoveryActions;
  let switchFetcherCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logger = new ErrorLogger();
    switchFetcherCallback = vi.fn();
    recoveryActions = new RecoveryActions(logger, {
      onSwitchFetcher: switchFetcherCallback,
    });
  });

  describe('triggerRecoveryAction - switch fetcher on persistent WebAPI failures', () => {
    it('should switch fetcher strategy when WebAPI fails persistently', async () => {
      // Simulate 3 consecutive WebAPI failures (threshold)
      await recoveryActions.handlePersistentWebAPIFailure();
      await recoveryActions.handlePersistentWebAPIFailure();
      const result = await recoveryActions.handlePersistentWebAPIFailure();

      expect(result.action).toBe('switch_fetcher');
      expect(result.success).toBe(true);
      expect(recoveryActions.getCurrentFetcher()).toBe('cli');
      expect(switchFetcherCallback).toHaveBeenCalledWith('cli');
    });

    it('should not switch fetcher before reaching threshold', async () => {
      const result = await recoveryActions.handlePersistentWebAPIFailure();

      expect(result.action).toBe('none');
      expect(recoveryActions.getCurrentFetcher()).toBe('webapi');
    });

    it('should reset failure count after switching', async () => {
      await recoveryActions.handlePersistentWebAPIFailure();
      await recoveryActions.handlePersistentWebAPIFailure();
      await recoveryActions.handlePersistentWebAPIFailure();

      expect(recoveryActions.getConsecutiveWebAPIFailures()).toBe(0);
    });
  });

  describe('switchFetcher', () => {
    it('should toggle between webapi and cli', async () => {
      expect(recoveryActions.getCurrentFetcher()).toBe('webapi');

      await recoveryActions.switchFetcher('test');
      expect(recoveryActions.getCurrentFetcher()).toBe('cli');

      await recoveryActions.switchFetcher('test');
      expect(recoveryActions.getCurrentFetcher()).toBe('webapi');
    });
  });

  describe('gracefulDegradation', () => {
    it('should return degradation result', async () => {
      const result = await recoveryActions.gracefulDegradation('component', 'reason');

      expect(result.action).toBe('graceful_degradation');
      expect(result.success).toBe(true);
      expect(result.message).toContain('component');
    });
  });
});

describe('ErrorLogger', () => {
  let logger: ErrorLogger;

  beforeEach(() => {
    logger = new ErrorLogger(100);
  });

  it('should store log entries', () => {
    logger.error('test', 'test message');
    const logs = logger.getRecentLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].category).toBe('test');
  });

  it('should filter logs by level', () => {
    logger.info('a', 'info msg');
    logger.error('b', 'error msg');
    logger.warning('c', 'warn msg');

    expect(logger.getLogsByLevel('error')).toHaveLength(1);
    expect(logger.getLogsByLevel('info')).toHaveLength(1);
  });

  it('should filter logs by category', () => {
    logger.info('auth', 'msg 1');
    logger.error('auth', 'msg 2');
    logger.info('sync', 'msg 3');

    expect(logger.getLogsByCategory('auth')).toHaveLength(2);
  });

  it('should respect max log size', () => {
    const smallLogger = new ErrorLogger(5);
    for (let i = 0; i < 10; i++) {
      smallLogger.info('test', `message ${i}`);
    }
    expect(smallLogger.getRecentLogs(100)).toHaveLength(5);
  });

  it('should clear logs', () => {
    logger.info('test', 'msg');
    logger.clearLogs();
    expect(logger.getRecentLogs()).toHaveLength(0);
  });
});
