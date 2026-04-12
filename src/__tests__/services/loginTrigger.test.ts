import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginTrigger } from '../../services/loginTrigger';
import { LoginState, LoginError } from '../../types/auth';

function createMockKeychain() {
  return {
    storeSession: vi.fn().mockResolvedValue(undefined),
    retrieveSession: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    clearSession: vi.fn().mockResolvedValue(undefined),
    isSessionValid: vi.fn().mockResolvedValue(false),
    cleanupExpiredSession: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockAuthManager() {
  return {
    startLoginFlow: vi.fn().mockResolvedValue({ success: true, session: { cookies: 'c', sessionId: 's1', expiresAt: Date.now() + 900_000 } }),
    validateSession: vi.fn().mockResolvedValue(true),
    refreshSession: vi.fn().mockResolvedValue({ success: true }),
    getStoredSession: vi.fn().mockResolvedValue(null),
    logout: vi.fn().mockResolvedValue(undefined),
    cancelLoginFlow: vi.fn(),
    getLoginState: vi.fn().mockReturnValue(LoginState.IDLE),
    getFlowState: vi.fn().mockReturnValue({ isActive: false, currentStep: 'idle', progress: 0 }),
  };
}

describe('LoginTrigger', () => {
  let trigger: LoginTrigger;
  let mockKeychain: ReturnType<typeof createMockKeychain>;
  let mockAuthManager: ReturnType<typeof createMockAuthManager>;

  beforeEach(() => {
    mockKeychain = createMockKeychain();
    mockAuthManager = createMockAuthManager();
    trigger = new LoginTrigger(
      mockKeychain as any,
      mockAuthManager as any,
    );
  });

  describe('checkAuthenticationStatus', () => {
    it('returns IDLE when no credentials stored', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);

      const status = await trigger.checkAuthenticationStatus();

      expect(status).toBe(LoginState.IDLE);
      // No side effects — startLoginFlow should not have been called
      expect(mockAuthManager.startLoginFlow).not.toHaveBeenCalled();
      expect(mockKeychain.storeSession).not.toHaveBeenCalled();
      expect(mockKeychain.deleteSession).not.toHaveBeenCalled();
    });

    it('returns SUCCESS when valid credentials exist', async () => {
      mockKeychain.retrieveSession.mockResolvedValue({
        sessionData: JSON.stringify({ cookies: 'c', sessionId: 's1', expiresAt: Date.now() + 900_000 }),
        timestamp: Date.now(),
        isValid: true,
      });
      mockKeychain.isSessionValid.mockResolvedValue(true);

      const status = await trigger.checkAuthenticationStatus();

      expect(status).toBe(LoginState.SUCCESS);
    });

    it('returns ERROR when stored credentials are expired', async () => {
      mockKeychain.retrieveSession.mockResolvedValue({
        sessionData: JSON.stringify({ cookies: 'c', sessionId: 's1', expiresAt: Date.now() - 1000 }),
        timestamp: Date.now() - 1_000_000,
        isValid: true,
      });
      mockKeychain.isSessionValid.mockResolvedValue(false);

      const status = await trigger.checkAuthenticationStatus();

      expect(status).toBe(LoginState.ERROR);
    });

    it('returns ERROR when keychain access fails', async () => {
      mockKeychain.retrieveSession.mockRejectedValue(new Error('Keychain locked'));

      const status = await trigger.checkAuthenticationStatus();

      expect(status).toBe(LoginState.ERROR);
    });

    it('returns LOADING when a login flow is in progress', async () => {
      // Simulate a login in progress by starting one that never resolves
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.startLoginFlow.mockImplementation(() => new Promise(() => {}));

      const loginPromise = trigger.triggerLoginIfNeeded();

      // Flush microtasks so triggerLoginIfNeeded reaches the startLoginFlow await
      await Promise.resolve();
      await Promise.resolve();

      // While login is in progress, check status
      const status = await trigger.checkAuthenticationStatus();
      expect(status).toBe(LoginState.LOADING);
    });
  });

  describe('triggerLoginIfNeeded', () => {
    it('starts authentication flow when credentials missing', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);

      const triggered = await trigger.triggerLoginIfNeeded();

      expect(triggered).toBe(true);
      expect(mockAuthManager.startLoginFlow).toHaveBeenCalled();
    });

    it('does not start login when valid credentials exist', async () => {
      mockKeychain.retrieveSession.mockResolvedValue({
        sessionData: JSON.stringify({ cookies: 'c', sessionId: 's1', expiresAt: Date.now() + 900_000 }),
        timestamp: Date.now(),
        isValid: true,
      });
      mockKeychain.isSessionValid.mockResolvedValue(true);

      const triggered = await trigger.triggerLoginIfNeeded();

      expect(triggered).toBe(false);
      expect(mockAuthManager.startLoginFlow).not.toHaveBeenCalled();
    });

    it('starts login when credentials are expired', async () => {
      mockKeychain.retrieveSession.mockResolvedValue({
        sessionData: JSON.stringify({ cookies: 'c', sessionId: 's1', expiresAt: Date.now() - 1000 }),
        timestamp: Date.now() - 1_000_000,
        isValid: true,
      });
      mockKeychain.isSessionValid.mockResolvedValue(false);

      const triggered = await trigger.triggerLoginIfNeeded();

      expect(triggered).toBe(true);
      expect(mockAuthManager.startLoginFlow).toHaveBeenCalled();
    });

    it('propagates LoginError from authentication manager', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.startLoginFlow.mockRejectedValue(
        new LoginError('WebView failed to load', 'webview_failed'),
      );

      await expect(trigger.triggerLoginIfNeeded()).rejects.toThrow(LoginError);
    });

    it('wraps non-LoginError errors with trigger_failed code', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.startLoginFlow.mockRejectedValue(new Error('Unexpected'));

      try {
        await trigger.triggerLoginIfNeeded();
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LoginError);
        expect((err as LoginError).code).toBe('trigger_failed');
      }
    });
  });

  describe('onFetchTimerTick', () => {
    it('allows fetch to proceed when credentials are valid', async () => {
      mockKeychain.retrieveSession.mockResolvedValue({
        sessionData: JSON.stringify({ cookies: 'c', sessionId: 's1', expiresAt: Date.now() + 900_000 }),
        timestamp: Date.now(),
        isValid: true,
      });
      mockKeychain.isSessionValid.mockResolvedValue(true);

      const canProceed = await trigger.onFetchTimerTick();

      expect(canProceed).toBe(true);
      expect(mockAuthManager.startLoginFlow).not.toHaveBeenCalled();
    });

    it('triggers re-auth when credentials are missing and allows fetch after success', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);

      const canProceed = await trigger.onFetchTimerTick();

      expect(canProceed).toBe(true);
      expect(mockAuthManager.startLoginFlow).toHaveBeenCalled();
    });

    it('returns false when re-auth fails', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.startLoginFlow.mockRejectedValue(
        new LoginError('Login failed', 'webview_failed'),
      );

      const canProceed = await trigger.onFetchTimerTick();

      expect(canProceed).toBe(false);
    });

    it('returns false when login is already in progress', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.startLoginFlow.mockImplementation(() => new Promise(() => {}));

      // Start a login that will hang
      const loginPromise = trigger.triggerLoginIfNeeded();

      // Flush microtasks so triggerLoginIfNeeded reaches the startLoginFlow await
      await Promise.resolve();
      await Promise.resolve();

      // Timer tick during active login should return false
      const canProceed = await trigger.onFetchTimerTick();
      expect(canProceed).toBe(false);
    });
  });

  describe('onAppStartup', () => {
    it('detects first-run when no session exists', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);

      await trigger.onAppStartup();

      const status = trigger.getStatus();
      expect(status.isFirstRun).toBe(true);
      expect(mockAuthManager.startLoginFlow).toHaveBeenCalled();
    });

    it('detects existing session on startup', async () => {
      mockKeychain.retrieveSession.mockResolvedValue({
        sessionData: JSON.stringify({ cookies: 'c', sessionId: 's1', expiresAt: Date.now() + 900_000 }),
        timestamp: Date.now(),
        isValid: true,
      });
      mockKeychain.isSessionValid.mockResolvedValue(true);

      await trigger.onAppStartup();

      const status = trigger.getStatus();
      expect(status.isFirstRun).toBe(false);
      expect(mockAuthManager.startLoginFlow).not.toHaveBeenCalled();
    });

    it('handles startup login failure gracefully in LaunchAgent context', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.startLoginFlow.mockRejectedValue(
        new LoginError('No display available', 'webview_failed'),
      );

      // Should not throw — startup failure is non-fatal
      await expect(trigger.onAppStartup()).resolves.toBeUndefined();
    });

    it('respects autoTriggerOnStartup=false config', async () => {
      const noAutoTrigger = new LoginTrigger(
        mockKeychain as any,
        mockAuthManager as any,
        { autoTriggerOnStartup: false },
      );

      mockKeychain.retrieveSession.mockResolvedValue(null);

      await noAutoTrigger.onAppStartup();

      expect(mockAuthManager.startLoginFlow).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns current trigger status', () => {
      const status = trigger.getStatus();

      expect(status.loginState).toBe(LoginState.IDLE);
      expect(status.flowState).toEqual({ isActive: false, currentStep: 'idle', progress: 0 });
      expect(status.isFirstRun).toBe(true);
      expect(status.lastValidationTime).toBeNull();
    });

    it('reflects updated state after successful login', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);
      mockAuthManager.getLoginState.mockReturnValue(LoginState.SUCCESS);

      await trigger.triggerLoginIfNeeded();

      const status = trigger.getStatus();
      expect(status.loginState).toBe(LoginState.SUCCESS);
      expect(status.lastValidationTime).toBeGreaterThan(0);
    });
  });

  describe('manualLoginTrigger', () => {
    it('delegates to triggerLoginIfNeeded', async () => {
      mockKeychain.retrieveSession.mockResolvedValue(null);

      const triggered = await trigger.manualLoginTrigger();

      expect(triggered).toBe(true);
      expect(mockAuthManager.startLoginFlow).toHaveBeenCalled();
    });
  });
});
