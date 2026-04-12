import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginWebView, LoginError } from '../../components/loginWebView';
import { WebViewMessageType } from '../../types/webview';
import type { WebViewMessage } from '../../types/webview';

// Mock electron module
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn();
const mockIsDestroyed = vi.fn().mockReturnValue(false);
const mockSetUserAgent = vi.fn();
const mockGetCookies = vi.fn();
const mockOn = vi.fn();
const mockOnce = vi.fn();

class MockBrowserWindow {
  loadURL = mockLoadURL;
  close = mockClose;
  isDestroyed = mockIsDestroyed;
  on = mockOn;
  webContents = {
    setUserAgent: mockSetUserAgent,
    on: mockOn,
    once: mockOnce,
    session: {
      cookies: {
        get: mockGetCookies,
      },
    },
  };

  constructor(_opts?: any) {}
}

vi.mock('electron', () => ({
  BrowserWindow: MockBrowserWindow,
}));

describe('LoginWebView', () => {
  let webView: LoginWebView;
  let messageHandler: ReturnType<typeof vi.fn>;
  let dismissHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageHandler = vi.fn();
    dismissHandler = vi.fn();

    // Default: simulate did-finish-load firing immediately
    mockOnce.mockImplementation((event: string, callback: (...args: any[]) => void) => {
      if (event === 'did-finish-load') {
        setTimeout(() => callback(), 0);
      }
    });

    webView = new LoginWebView({
      config: { url: 'https://claude.ai/login', timeout: 5000 },
      onMessage: messageHandler,
      onDismiss: dismissHandler,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadLoginPage', () => {
    it('successfully loads Claude.ai login page', async () => {
      await webView.loadLoginPage();

      expect(mockLoadURL).toHaveBeenCalledWith('https://claude.ai/login');
      expect(webView.getLoadingState()).toBe('loaded');

      // Verify PAGE_LOADED message was emitted
      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebViewMessageType.PAGE_LOADED,
          payload: { url: 'https://claude.ai/login' },
        })
      );
    });

    it('applies custom user agent when provided', async () => {
      const customWebView = new LoginWebView({
        config: {
          url: 'https://claude.ai/login',
          userAgent: 'CustomAgent/1.0',
          timeout: 5000,
        },
        onMessage: messageHandler,
      });

      await customWebView.loadLoginPage();

      expect(mockSetUserAgent).toHaveBeenCalledWith('CustomAgent/1.0');
    });

    it('rejects with LoginError on timeout', async () => {
      // Override: never fire did-finish-load
      mockOnce.mockImplementation(() => {});

      const timeoutWebView = new LoginWebView({
        config: { url: 'https://claude.ai/login', timeout: 50 },
        onMessage: messageHandler,
      });

      await expect(timeoutWebView.loadLoginPage()).rejects.toThrow(LoginError);
      await expect(
        new LoginWebView({
          config: { url: 'https://claude.ai/login', timeout: 50 },
        }).loadLoginPage()
      ).rejects.toThrow('timed out');
    });

    it('rejects with LoginError on load failure', async () => {
      mockOnce.mockImplementation((event: string, callback: (...args: any[]) => void) => {
        if (event === 'did-fail-load') {
          setTimeout(() => callback({}, -6, 'ERR_CONNECTION_REFUSED'), 0);
        }
      });

      const failWebView = new LoginWebView({
        config: { url: 'https://claude.ai/login', timeout: 5000 },
      });

      await expect(failWebView.loadLoginPage()).rejects.toThrow('Failed to load login page');
    });
  });

  describe('extractSessionData', () => {
    it('throws LoginError with code no_session when no session cookies present', async () => {
      await webView.loadLoginPage();

      mockGetCookies.mockResolvedValue([]);

      try {
        await webView.extractSessionData();
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LoginError);
        expect((err as LoginError).code).toBe('no_session');
        expect((err as LoginError).message).toContain('authentication');
      }
    });

    it('throws LoginError when webview is not active', async () => {
      // Don't load the page — webContents is null
      const freshWebView = new LoginWebView();

      try {
        await freshWebView.extractSessionData();
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LoginError);
        expect((err as LoginError).code).toBe('no_session');
      }
    });

    it('returns session data when cookies are present', async () => {
      await webView.loadLoginPage();

      mockGetCookies.mockResolvedValue([
        {
          name: 'sessionKey',
          value: 'abc123',
          domain: '.claude.ai',
          path: '/',
          httpOnly: true,
          secure: true,
        },
      ]);

      const sessionData = await webView.extractSessionData();

      expect(sessionData.cookies).toHaveLength(1);
      expect(sessionData.cookies[0].name).toBe('sessionKey');
      expect(sessionData.token).toBe('abc123');
    });
  });

  describe('dismiss', () => {
    it('properly cleans up WebView resources and notifies parent', async () => {
      await webView.loadLoginPage();

      expect(webView.isActive()).toBe(true);

      webView.dismiss();

      expect(mockClose).toHaveBeenCalled();
      expect(webView.isActive()).toBe(false);
      expect(webView.getLoadingState()).toBe('idle');
      expect(dismissHandler).toHaveBeenCalledOnce();
    });

    it('is safe to call multiple times', async () => {
      await webView.loadLoginPage();

      webView.dismiss();
      webView.dismiss();

      // dismiss handler should only be called once (second dismiss is a no-op because isDestroyed is true)
      expect(dismissHandler).toHaveBeenCalledOnce();
    });

    it('does not throw when called before loading', () => {
      const freshWebView = new LoginWebView({ onDismiss: dismissHandler });
      expect(() => freshWebView.dismiss()).not.toThrow();
    });
  });

  describe('handleLoginSuccess', () => {
    it('returns success response with session data', async () => {
      await webView.loadLoginPage();

      mockGetCookies.mockResolvedValue([
        {
          name: 'sessionKey',
          value: 'token123',
          domain: '.claude.ai',
          path: '/',
          httpOnly: true,
          secure: true,
        },
      ]);

      const response = await webView.handleLoginSuccess();

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.cookies).toHaveLength(1);

      // Should emit LOGIN_SUCCESS message
      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebViewMessageType.LOGIN_SUCCESS,
        })
      );
    });

    it('returns error response when session extraction fails', async () => {
      await webView.loadLoginPage();

      mockGetCookies.mockResolvedValue([]);

      const response = await webView.handleLoginSuccess();

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();

      // Should emit LOGIN_ERROR message
      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WebViewMessageType.LOGIN_ERROR,
        })
      );
    });
  });

  describe('constructor defaults', () => {
    it('uses default Claude.ai login URL and timeout', () => {
      const defaultWebView = new LoginWebView();
      expect(defaultWebView.getLoadingState()).toBe('idle');
      expect(defaultWebView.isActive()).toBe(false);
    });
  });
});
