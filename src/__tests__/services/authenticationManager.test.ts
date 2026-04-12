import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuthenticationManager } from '../../services/authenticationManager';
import { LoginState, LoginError } from '../../types/auth';

function createMockWebView() {
  return {
    loadLoginPage: vi.fn().mockResolvedValue(undefined),
    handleLoginSuccess: vi.fn().mockResolvedValue({
      success: true,
      data: {
        cookies: [{ name: 'sessionKey', value: 'abc123', domain: '.claude.ai', path: '/', httpOnly: true, secure: true }],
        token: 'abc123',
      },
    }),
    extractSessionData: vi.fn(),
    dismiss: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
    getLoadingState: vi.fn().mockReturnValue('idle'),
  };
}

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

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let mockKeychain: ReturnType<typeof createMockKeychain>;
  let mockWebView: ReturnType<typeof createMockWebView>;
  let webViewFactory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockKeychain = createMockKeychain();
    mockWebView = createMockWebView();
    webViewFactory = vi.fn().mockReturnValue(mockWebView);
    authManager = new AuthenticationManager(
      mockKeychain as any,
      undefined,
      webViewFactory as any,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startLoginFlow', () => {
    it('successfully completes authentication and stores session', async () => {
      const result = await authManager.startLoginFlow();

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session!.sessionId).toBe('abc123');
      expect(result.session!.cookies).toBeDefined();
      expect(result.session!.expiresAt).toBeGreaterThan(0);
      expect(authManager.getLoginState()).toBe(LoginState.SUCCESS);
      expect(mockKeychain.storeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'abc123',
        }),
      );
    });

    it('throws LoginError when WebView fails to load', async () => {
      mockWebView.loadLoginPage.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(
        authManager.startLoginFlow({ maxRetries: 0, timeoutMs: 1000, baseUrl: 'https://claude.ai/login' }),
      ).rejects.toThrow(LoginError);

      expect(authManager.getLoginState()).toBe(LoginState.ERROR);

      // Verify error code in a fresh manager
      const authManager2 = new AuthenticationManager(
        mockKeychain as any,
        undefined,
        webViewFactory as any,
      );

      try {
        await authManager2.startLoginFlow({ maxRetries: 0, timeoutMs: 1000, baseUrl: 'https://claude.ai/login' });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LoginError);
        expect((err as LoginError).code).toBe('webview_failed');
      }
    });

    it('prevents concurrent login flows', async () => {
      mockWebView.loadLoginPage.mockImplementation(
        () => new Promise(() => {}), // never resolves
      );

      const flowPromise = authManager.startLoginFlow();

      await expect(
        authManager.startLoginFlow(),
      ).rejects.toThrow('A login flow is already active');

      authManager.cancelLoginFlow();
    });

    it('retries with exponential backoff on failure', async () => {
      mockWebView.loadLoginPage
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      const resultPromise = authManager.startLoginFlow({
        maxRetries: 2,
        timeoutMs: 1000,
        baseUrl: 'https://claude.ai/login',
      });

      // Advance through backoff delays
      await vi.advanceTimersByTimeAsync(1000); // first retry backoff
      await vi.advanceTimersByTimeAsync(2000); // second retry backoff

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockWebView.loadLoginPage).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateSession', () => {
    it('returns true for a valid session', async () => {
      mockKeychain.isSessionValid.mockResolvedValue(true);

      const isValid = await authManager.validateSession();

      expect(isValid).toBe(true);
      expect(mockKeychain.cleanupExpiredSession).not.toHaveBeenCalled();
    });

    it('detects expired session and triggers refresh', async () => {
      mockKeychain.isSessionValid.mockResolvedValue(false);

      mockWebView.handleLoginSuccess.mockResolvedValue({
        success: true,
        data: {
          cookies: [{ name: 'sessionKey', value: 'new-token', domain: '.claude.ai', path: '/', httpOnly: true, secure: true }],
          token: 'new-token',
        },
      });

      const isValid = await authManager.validateSession();

      expect(isValid).toBe(false);
      expect(mockKeychain.cleanupExpiredSession).toHaveBeenCalled();
      expect(mockKeychain.storeSession).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears session and resets state', async () => {
      await authManager.startLoginFlow();
      await authManager.logout();

      expect(mockKeychain.clearSession).toHaveBeenCalled();
      expect(authManager.getLoginState()).toBe(LoginState.IDLE);
    });
  });

  describe('cancelLoginFlow', () => {
    it('cancels an active login flow', async () => {
      mockWebView.loadLoginPage.mockImplementation(
        () => new Promise(() => {}),
      );

      const flowPromise = authManager.startLoginFlow();
      // Let the microtask queue flush so attemptLogin creates the webview
      await vi.advanceTimersByTimeAsync(0);

      authManager.cancelLoginFlow();

      expect(authManager.getLoginState()).toBe(LoginState.IDLE);
      expect(mockWebView.dismiss).toHaveBeenCalled();
    });
  });

  describe('getFlowState', () => {
    it('returns initial flow state', () => {
      const state = authManager.getFlowState();

      expect(state.isActive).toBe(false);
      expect(state.currentStep).toBe('idle');
      expect(state.progress).toBe(0);
    });
  });
});
