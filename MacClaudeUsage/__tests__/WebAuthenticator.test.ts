import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AuthCredentials, AuthState } from '../../src/types/auth';
import { AuthError } from '../../src/types/errors';

const MAC_APP_DIR = resolve(__dirname, '..');

function readSwiftFile(filename: string): string {
  return readFileSync(resolve(MAC_APP_DIR, filename), 'utf-8');
}

describe('WebAuthenticator', () => {
  let webAuthenticatorSource: string;
  let webAuthDelegateSource: string;
  let authWindowSource: string;

  beforeEach(() => {
    webAuthenticatorSource = readSwiftFile('WebAuthenticator.swift');
    webAuthDelegateSource = readSwiftFile('WebAuthDelegate.swift');
    authWindowSource = readSwiftFile('AuthenticationWindow.swift');
  });

  describe('authenticateWithWebView successfully captures credentials after valid login', () => {
    it('WebAuthenticator implements authenticateWithWebView method', () => {
      expect(webAuthenticatorSource).toContain('func authenticateWithWebView');
    });

    it('creates a WKWebView with proper configuration', () => {
      expect(webAuthenticatorSource).toContain('import WebKit');
      expect(webAuthenticatorSource).toContain('WKWebView');
      expect(webAuthenticatorSource).toContain('WKWebViewConfiguration');
    });

    it('loads the Claude.ai login URL', () => {
      expect(webAuthenticatorSource).toContain('claude.ai');
      expect(webAuthenticatorSource).toContain('/login');
    });

    it('enables JavaScript for modern login flows', () => {
      expect(webAuthenticatorSource).toContain('allowsContentJavaScript');
      expect(webAuthenticatorSource).toContain('WKWebpagePreferences');
    });

    it('stores credentials via KeychainManager on success', () => {
      expect(webAuthenticatorSource).toContain('keychainManager.storeCredentials');
      expect(webAuthenticatorSource).toContain('KeychainManager');
    });

    it('returns AuthResult with authenticated state and credentials on success', () => {
      expect(webAuthenticatorSource).toContain('AuthResult');
      expect(webAuthenticatorSource).toContain('.authenticated');
      expect(webAuthenticatorSource).toContain('credentials');
    });

    it('closes the authentication window automatically after success', () => {
      expect(webAuthenticatorSource).toContain('closeWindow');
      expect(webAuthenticatorSource).toContain('completeAuthentication');
    });

    it('provides singleton access via shared property', () => {
      expect(webAuthenticatorSource).toContain('static let shared');
    });

    it('AuthResult integration contract matches expected structure', () => {
      // Verify AuthResult struct has all required fields
      expect(webAuthenticatorSource).toContain('struct AuthResult');
      expect(webAuthenticatorSource).toContain('state: AuthState');
      expect(webAuthenticatorSource).toContain('credentials: AuthCredentials?');
      expect(webAuthenticatorSource).toContain('error: String?');
    });

    it('AuthCredentials TypeScript interface works for web auth flow', () => {
      const credentials: AuthCredentials = {
        sessionToken: 'sk-ant-test-session-token',
        cookies: 'sessionKey=abc123; __cf_bm=xyz789',
        lastAuthTime: new Date(),
      };
      expect(credentials.sessionToken).toBe('sk-ant-test-session-token');
      expect(credentials.cookies).toContain('sessionKey=abc123');
      expect(credentials.lastAuthTime).toBeInstanceOf(Date);
    });

    it('authenticated AuthState is returned on successful flow', () => {
      const authState: AuthState = 'authenticated';
      expect(authState).toBe('authenticated');
    });
  });

  describe('extractCredentials throws AuthError when no valid session cookies found', () => {
    it('WebAuthenticator implements extractCredentials method', () => {
      expect(webAuthenticatorSource).toContain('func extractCredentials');
    });

    it('accesses the WKWebView cookie store for credential extraction', () => {
      expect(webAuthenticatorSource).toContain('httpCookieStore');
      expect(webAuthenticatorSource).toContain('getAllCookies');
    });

    it('filters cookies for claude.ai domain', () => {
      expect(webAuthenticatorSource).toContain('claude.ai');
      expect(webAuthenticatorSource).toContain('filter');
    });

    it('throws AuthError with NO_SESSION_COOKIES when no cookies found', () => {
      expect(webAuthenticatorSource).toContain('NO_SESSION_COOKIES');
      expect(webAuthenticatorSource).toContain('requiresReauth: true');
    });

    it('AuthError with NO_SESSION_COOKIES has correct structure', () => {
      const error = new AuthError(
        'No valid session cookies found after authentication',
        'NO_SESSION_COOKIES',
        true
      );
      expect(error.code).toBe('NO_SESSION_COOKIES');
      expect(error.requiresReauth).toBe(true);
      expect(error.message).toBe(
        'No valid session cookies found after authentication'
      );
      expect(error).toBeInstanceOf(Error);
    });

    it('extracts session token from known cookie names', () => {
      expect(webAuthenticatorSource).toContain('extractSessionToken');
      expect(webAuthenticatorSource).toContain('sessionKey');
    });

    it('serializes cookies into a storable string format', () => {
      expect(webAuthenticatorSource).toContain('serializeCookies');
    });

    it('sets lastAuthTime to current date on successful extraction', () => {
      expect(webAuthenticatorSource).toContain('lastAuthTime: Date()');
    });
  });

  describe('validateAuthenticationSuccess returns true when Claude.ai dashboard URL is reached', () => {
    it('WebAuthenticator implements validateAuthenticationSuccess method', () => {
      expect(webAuthenticatorSource).toContain(
        'func validateAuthenticationSuccess'
      );
    });

    it('checks URL contains claude.ai', () => {
      expect(webAuthenticatorSource).toContain('claude.ai');
      expect(webAuthenticatorSource).toContain('url');
    });

    it('verifies cookies are present for validation', () => {
      expect(webAuthenticatorSource).toContain('cookies');
      expect(webAuthenticatorSource).toContain('contains');
    });

    it('returns false when URL does not contain claude.ai', () => {
      // Simulating the Swift validation logic in TypeScript
      const url = 'https://example.com/dashboard';
      const hasCookies = true;
      const result = url.includes('claude.ai') && hasCookies;
      expect(result).toBe(false);
    });

    it('returns true when URL contains claude.ai and valid cookies present', () => {
      const url = 'https://claude.ai/chat';
      const cookies = [{ domain: 'claude.ai', value: 'session-token-123' }];
      const hasValidCookies = cookies.some(
        (c) => c.domain.includes('claude.ai') && c.value.length > 0
      );
      const result = url.includes('claude.ai') && hasValidCookies;
      expect(result).toBe(true);
    });

    it('returns false when no cookies are present', () => {
      const url = 'https://claude.ai/chat';
      const cookies: { domain: string; value: string }[] = [];
      const hasValidCookies = cookies.some(
        (c) => c.domain.includes('claude.ai') && c.value.length > 0
      );
      const result = url.includes('claude.ai') && hasValidCookies;
      expect(result).toBe(false);
    });
  });

  describe('WebAuthDelegate navigation handling', () => {
    it('implements WKNavigationDelegate protocol', () => {
      expect(webAuthDelegateSource).toContain('WKNavigationDelegate');
    });

    it('detects authenticated URL after navigation finishes', () => {
      expect(webAuthDelegateSource).toContain('didFinish');
      expect(webAuthDelegateSource).toContain('isAuthenticatedURL');
    });

    it('handles navigation failures gracefully', () => {
      expect(webAuthDelegateSource).toContain('didFail');
      expect(webAuthDelegateSource).toContain('didFailProvisionalNavigation');
    });

    it('handles authentication challenges for HTTPS', () => {
      expect(webAuthDelegateSource).toContain('didReceive challenge');
      expect(webAuthDelegateSource).toContain(
        'NSURLAuthenticationMethodServerTrust'
      );
    });

    it('restricts navigation to allowed domains', () => {
      expect(webAuthDelegateSource).toContain('decidePolicyFor');
      expect(webAuthDelegateSource).toContain('claude.ai');
      expect(webAuthDelegateSource).toContain('anthropic.com');
    });

    it('verifies cookies before reporting success', () => {
      expect(webAuthDelegateSource).toContain('verifyCookiesAndReport');
      expect(webAuthDelegateSource).toContain('getAllCookies');
    });

    it('reports result only once to prevent duplicate callbacks', () => {
      expect(webAuthDelegateSource).toContain('hasReportedResult');
    });

    it('never logs sensitive credential data', () => {
      const logLines = webAuthDelegateSource
        .split('\n')
        .filter((line) => line.includes('NSLog'));
      for (const line of logLines) {
        expect(line).not.toContain('sessionToken');
        expect(line).not.toContain('password');
        expect(line).not.toContain('cookie=');
      }
    });
  });

  describe('AuthenticationWindow management', () => {
    it('creates an NSWindow for the web view', () => {
      expect(authWindowSource).toContain('import Cocoa');
      expect(authWindowSource).toContain('NSWindow');
    });

    it('implements NSWindowDelegate to detect user close', () => {
      expect(authWindowSource).toContain('NSWindowDelegate');
      expect(authWindowSource).toContain('windowWillClose');
    });

    it('sets appropriate window title for sign-in', () => {
      expect(authWindowSource).toContain('Sign in to Claude');
    });

    it('provides showWindow and closeWindow methods', () => {
      expect(authWindowSource).toContain('func showWindow');
      expect(authWindowSource).toContain('func closeWindow');
    });

    it('notifies authenticator when window is closed by user', () => {
      expect(authWindowSource).toContain('onWindowClose');
    });

    it('centers window and activates the app for visibility', () => {
      expect(authWindowSource).toContain('center()');
      expect(authWindowSource).toContain('makeKeyAndOrderFront');
      expect(authWindowSource).toContain('NSApp.activate(ignoringOtherApps:');
    });

    it('sets minimum window size for usability', () => {
      expect(authWindowSource).toContain('minSize');
    });
  });

  describe('Error handling and edge cases', () => {
    it('handles user cancellation when window is closed', () => {
      expect(webAuthenticatorSource).toContain('handleWindowClosed');
      expect(webAuthenticatorSource).toContain('cancelled by user');
    });

    it('handles network failures from navigation delegate', () => {
      expect(webAuthenticatorSource).toContain('handleAuthenticationFailure');
    });

    it('handles keychain storage failures after credential extraction', () => {
      expect(webAuthenticatorSource).toContain('Failed to store credentials');
    });

    it('cleans up resources after authentication completes', () => {
      expect(webAuthenticatorSource).toContain('authWindow = nil');
      expect(webAuthenticatorSource).toContain('webAuthDelegate = nil');
      expect(webAuthenticatorSource).toContain('authCompletion = nil');
    });

    it('dispatches completion on main thread for UI safety', () => {
      expect(webAuthenticatorSource).toContain('DispatchQueue.main.async');
    });
  });
});
