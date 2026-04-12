import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  WebApiFetcher,
  setHttpClient,
  HttpClient,
  AuthenticationError,
  RateLimitError,
  NetworkError,
} from '../../fetchers/webApiFetcher';
import { KeychainManager, setKeychainBinding } from '../../services/keychainManager';
import { AuthenticationManager } from '../../services/authenticationManager';
import { StoredSession, LoginSession } from '../../types/storage';
import { SessionExpiredError } from '../../types/auth';

const mockLoginSession: LoginSession = {
  cookies: 'session=abc123',
  sessionId: 'tok_test',
  expiresAt: Date.now() + 60 * 60 * 1000,
};

const mockStoredSession: StoredSession = {
  sessionData: JSON.stringify(mockLoginSession),
  timestamp: Date.now(),
  isValid: true,
};

const mockUsageResponse = {
  tokensUsed: 5000,
  tokensLimit: 100000,
  messagesUsed: 10,
  messagesLimit: 50,
  resetTime: '2026-04-12T00:00:00Z',
};

function createMockHttpClient(
  overrides: Partial<{ status: number; ok: boolean; json: () => Promise<unknown> }> = {}
): HttpClient {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: () => Promise.resolve(mockUsageResponse),
    ...overrides,
  });
}

function createMockKeychainBinding(stored: string | null = JSON.stringify(mockStoredSession)) {
  return {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue(stored),
    deletePassword: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WebApiFetcher', () => {
  let fetcher: WebApiFetcher;
  let keychainManager: KeychainManager;
  let authManager: AuthenticationManager;
  let mockHttp: HttpClient;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockBinding = createMockKeychainBinding();
    setKeychainBinding(mockBinding);

    keychainManager = new KeychainManager();
    authManager = new AuthenticationManager(keychainManager);

    mockHttp = createMockHttpClient();
    setHttpClient(mockHttp);

    fetcher = new WebApiFetcher(keychainManager, authManager, {
      baseUrl: 'https://claude.ai',
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    setHttpClient(null);
    setKeychainBinding(null);
  });

  describe('fetch', () => {
    it('successfully retrieves data with valid stored credentials', async () => {
      const result = await fetcher.fetch();

      expect(result.tokensUsed).toBe(5000);
      expect(result.tokensLimit).toBe(100000);
      expect(result.messagesUsed).toBe(10);
      expect(result.messagesLimit).toBe(50);
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(result.lastUpdated).toBeInstanceOf(Date);

      expect(mockHttp).toHaveBeenCalledWith(
        'https://claude.ai/api/usage',
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'session=abc123',
            Authorization: 'Bearer tok_test',
          }),
        }),
      );
    });

    it('triggers re-authentication when receiving HTTP 401 response', async () => {
      const refreshedSession: LoginSession = {
        cookies: 'session=refreshed',
        sessionId: 'tok_refreshed',
        expiresAt: Date.now() + 60 * 60 * 1000,
      };

      let callCount = 0;
      const mockHttpWithRetry: HttpClient = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            status: 401,
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockUsageResponse),
        });
      });
      setHttpClient(mockHttpWithRetry);

      vi.spyOn(authManager, 'refreshSession').mockResolvedValue({
        success: true,
        session: refreshedSession,
      });

      const result = await fetcher.fetch();

      expect(authManager.refreshSession).toHaveBeenCalledTimes(1);
      expect(result.tokensUsed).toBe(5000);
      expect(mockHttpWithRetry).toHaveBeenCalledTimes(2);
    });

    it('triggers re-authentication when receiving HTTP 403 response', async () => {
      const refreshedSession: LoginSession = {
        cookies: 'session=refreshed',
        sessionId: 'tok_refreshed',
        expiresAt: Date.now() + 60 * 60 * 1000,
      };

      let callCount = 0;
      const mockHttpWith403: HttpClient = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            status: 403,
            ok: false,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(mockUsageResponse),
        });
      });
      setHttpClient(mockHttpWith403);

      vi.spyOn(authManager, 'refreshSession').mockResolvedValue({
        success: true,
        session: refreshedSession,
      });

      const result = await fetcher.fetch();

      expect(authManager.refreshSession).toHaveBeenCalledTimes(1);
      expect(result.tokensUsed).toBe(5000);
    });

    it('throws SessionExpiredError when re-authentication fails', async () => {
      const mockHttp401: HttpClient = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.resolve({}),
      });
      setHttpClient(mockHttp401);

      vi.spyOn(authManager, 'refreshSession').mockResolvedValue({
        success: false,
      });

      await expect(fetcher.fetch()).rejects.toThrow(SessionExpiredError);
    });

    it('throws SessionExpiredError when no valid credentials are stored', async () => {
      setKeychainBinding(createMockKeychainBinding(null));
      keychainManager = new KeychainManager();
      fetcher = new WebApiFetcher(keychainManager, authManager, {
        baseUrl: 'https://claude.ai',
        timeoutMs: 5000,
      });

      await expect(fetcher.fetch()).rejects.toThrow(SessionExpiredError);
      await expect(fetcher.fetch()).rejects.toThrow(
        'No valid authentication credentials available'
      );
    });

    it('throws RateLimitError on HTTP 429', async () => {
      const mockHttp429: HttpClient = vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
        json: () => Promise.resolve({}),
      });
      setHttpClient(mockHttp429);

      await expect(fetcher.fetch()).rejects.toThrow(RateLimitError);
    });

    it('throws NetworkError on non-auth HTTP errors', async () => {
      const mockHttp500: HttpClient = vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        json: () => Promise.resolve({}),
      });
      setHttpClient(mockHttp500);

      await expect(fetcher.fetch()).rejects.toThrow(NetworkError);
    });
  });

  describe('isAuthenticationRequired', () => {
    it('returns true when no credentials stored', async () => {
      setKeychainBinding(createMockKeychainBinding(null));
      keychainManager = new KeychainManager();
      fetcher = new WebApiFetcher(keychainManager, authManager, {
        baseUrl: 'https://claude.ai',
        timeoutMs: 5000,
      });

      const result = await fetcher.isAuthenticationRequired();
      expect(result).toBe(true);
    });

    it('returns false when valid credentials exist', async () => {
      const result = await fetcher.isAuthenticationRequired();
      expect(result).toBe(false);
    });

    it('returns true when stored session is expired', async () => {
      const expiredSession: StoredSession = {
        sessionData: JSON.stringify({
          cookies: 'old',
          sessionId: 'old',
          expiresAt: Date.now() - 1000,
        }),
        timestamp: Date.now() - 20 * 60 * 1000, // 20 min ago
        isValid: true,
      };
      setKeychainBinding(
        createMockKeychainBinding(JSON.stringify(expiredSession))
      );
      keychainManager = new KeychainManager();
      fetcher = new WebApiFetcher(keychainManager, authManager, {
        baseUrl: 'https://claude.ai',
        timeoutMs: 5000,
      });

      const result = await fetcher.isAuthenticationRequired();
      expect(result).toBe(true);
    });
  });

  describe('type', () => {
    it('returns webapi as the fetcher type', () => {
      expect(fetcher.type).toBe('webapi');
    });
  });

  describe('headers', () => {
    it('includes Cookie and Authorization headers from session', async () => {
      await fetcher.fetch();

      expect(mockHttp).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'session=abc123',
            Authorization: 'Bearer tok_test',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });
});
