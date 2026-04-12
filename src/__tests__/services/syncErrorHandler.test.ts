import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncErrorHandler, SyncErrorCode } from '../../services/SyncErrorHandler';
import { SyncError } from '../../types/sync';
import { RetryConfig } from '../../types/retry';

describe('SyncErrorHandler', () => {
  let handler: SyncErrorHandler;

  beforeEach(() => {
    handler = new SyncErrorHandler();
    vi.restoreAllMocks();
  });

  describe('executeWithRetry', () => {
    it('attempts operation 5 times with exponential backoff on network failure', async () => {
      const config: RetryConfig = {
        maxAttempts: 5,
        baseDelay: 100,
        maxDelay: 30000,
        backoffMultiplier: 2,
      };

      const operation = vi.fn().mockRejectedValue(
        new SyncError('Network error', 'NETWORK_UNAVAILABLE', 'sync', true)
      );

      const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

      await expect(handler.executeWithRetry(operation, config)).rejects.toThrow(
        SyncError
      );

      expect(operation).toHaveBeenCalledTimes(5);

      // Verify exponential backoff delays: 100, 200, 400, 800
      const delayCalls = sleepSpy.mock.calls
        .filter(([, delay]) => typeof delay === 'number' && delay >= 100)
        .map(([, delay]) => delay);

      expect(delayCalls).toEqual([100, 200, 400, 800]);
    });

    it('returns result on success without retrying', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await handler.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('succeeds after transient failures', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(
          new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
        )
        .mockRejectedValueOnce(
          new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
        )
        .mockResolvedValue('recovered');

      const result = await handler.executeWithRetry(operation);

      expect(result).toBe('recovered');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('throws immediately for non-recoverable errors', async () => {
      const operation = vi.fn().mockRejectedValue(
        new SyncError('Fatal', 'DESERIALIZE_FAILED', 'read', false)
      );

      await expect(handler.executeWithRetry(operation)).rejects.toMatchObject({
        code: 'DESERIALIZE_FAILED',
        recoverable: false,
      });

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('throws when circuit breaker is open and cooldown has not elapsed', async () => {
      // Trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        handler.handleSyncError(
          new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
        );
      }

      expect(handler.getCircuitBreakerState().isOpen).toBe(true);

      const operation = vi.fn().mockResolvedValue('ok');
      await expect(handler.executeWithRetry(operation)).rejects.toThrow(
        'Circuit breaker is open'
      );
      expect(operation).not.toHaveBeenCalled();
    });

    it('resets circuit breaker on successful operation', async () => {
      handler.handleSyncError(
        new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
      );
      handler.handleSyncError(
        new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
      );

      expect(handler.getCircuitBreakerState().failureCount).toBe(2);

      const operation = vi.fn().mockResolvedValue('ok');
      await handler.executeWithRetry(operation);

      expect(handler.getCircuitBreakerState().failureCount).toBe(0);
    });
  });

  describe('handleSyncError', () => {
    it('opens circuit breaker after 3 consecutive failures', () => {
      const error = new SyncError(
        'Network unavailable',
        'NETWORK_UNAVAILABLE',
        'sync',
        true
      );

      handler.handleSyncError(error);
      expect(handler.getCircuitBreakerState().isOpen).toBe(false);
      expect(handler.getCircuitBreakerState().failureCount).toBe(1);

      handler.handleSyncError(error);
      expect(handler.getCircuitBreakerState().isOpen).toBe(false);
      expect(handler.getCircuitBreakerState().failureCount).toBe(2);

      handler.handleSyncError(error);
      expect(handler.getCircuitBreakerState().isOpen).toBe(true);
      expect(handler.getCircuitBreakerState().failureCount).toBe(3);
    });

    it('classifies NETWORK_UNAVAILABLE errors correctly', () => {
      const error = new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true);
      const result = handler.handleSyncError(error);

      expect(result.code).toBe(SyncErrorCode.NETWORK_UNAVAILABLE);
      expect(result.recoverable).toBe(true);
      expect(result.message).toContain('network');
    });

    it('classifies QUOTA_EXCEEDED errors correctly', () => {
      const error = new SyncError('fail', 'QUOTA_EXCEEDED', 'write', false);
      const result = handler.handleSyncError(error);

      expect(result.code).toBe(SyncErrorCode.QUOTA_EXCEEDED);
      expect(result.recoverable).toBe(false);
      expect(result.message).toContain('storage');
    });

    it('classifies ACCOUNT_UNAVAILABLE errors correctly', () => {
      const error = new SyncError('fail', 'ACCOUNT_UNAVAILABLE', 'read', false);
      const result = handler.handleSyncError(error);

      expect(result.code).toBe(SyncErrorCode.ACCOUNT_UNAVAILABLE);
      expect(result.message).toContain('account');
    });

    it('classifies ICLOUD_UNAVAILABLE as NETWORK_UNAVAILABLE', () => {
      const error = new SyncError('fail', 'ICLOUD_UNAVAILABLE', 'sync', true);
      const result = handler.handleSyncError(error);

      expect(result.code).toBe(SyncErrorCode.NETWORK_UNAVAILABLE);
    });

    it('classifies unknown errors as SERVICE_UNAVAILABLE', () => {
      const result = handler.handleSyncError(new Error('unknown'));

      expect(result.code).toBe(SyncErrorCode.SERVICE_UNAVAILABLE);
      expect(result.recoverable).toBe(false);
    });

    it('logs warnings for each error', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true);

      handler.handleSyncError(error);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NETWORK_UNAVAILABLE')
      );
    });
  });

  describe('attemptRecovery', () => {
    it('successfully resumes operations when iCloud becomes available', async () => {
      const checker = vi.fn().mockResolvedValue(true);
      const recoverableHandler = new SyncErrorHandler(checker);

      // Trip the circuit breaker
      for (let i = 0; i < 3; i++) {
        recoverableHandler.handleSyncError(
          new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
        );
      }

      expect(recoverableHandler.getCircuitBreakerState().isOpen).toBe(true);

      const recovered = await recoverableHandler.attemptRecovery();

      expect(recovered).toBe(true);
      expect(recoverableHandler.getCircuitBreakerState().isOpen).toBe(false);
      expect(recoverableHandler.getCircuitBreakerState().failureCount).toBe(0);
    });

    it('returns false when iCloud is still unavailable', async () => {
      const checker = vi.fn().mockResolvedValue(false);
      const recoverableHandler = new SyncErrorHandler(checker);

      for (let i = 0; i < 3; i++) {
        recoverableHandler.handleSyncError(
          new SyncError('fail', 'NETWORK_UNAVAILABLE', 'sync', true)
        );
      }

      const recovered = await recoverableHandler.attemptRecovery();

      expect(recovered).toBe(false);
      expect(recoverableHandler.getCircuitBreakerState().isOpen).toBe(true);
    });

    it('returns false when availability check throws', async () => {
      const checker = vi.fn().mockRejectedValue(new Error('check failed'));
      const recoverableHandler = new SyncErrorHandler(checker);

      const recovered = await recoverableHandler.attemptRecovery();

      expect(recovered).toBe(false);
    });

    it('logs recovery success', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const checker = vi.fn().mockResolvedValue(true);
      const recoverableHandler = new SyncErrorHandler(checker);

      await recoverableHandler.attemptRecovery();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recovery successful')
      );
    });
  });

  describe('getCircuitBreakerState', () => {
    it('returns a copy of the state', () => {
      const state1 = handler.getCircuitBreakerState();
      const state2 = handler.getCircuitBreakerState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('starts with circuit breaker closed', () => {
      const state = handler.getCircuitBreakerState();

      expect(state.isOpen).toBe(false);
      expect(state.failureCount).toBe(0);
      expect(state.cooldownPeriod).toBe(60000);
    });
  });
});
