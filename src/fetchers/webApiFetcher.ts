import { UsageData } from '../types/sync';
import { FetcherType } from '../types/fetcher';
import { UsageFetcher } from '../services/MacFetchService';
import { KeychainManager } from '../services/keychainManager';
import { AuthenticationManager } from '../services/authenticationManager';
import { StoredSession, LoginSession } from '../types/storage';
import { SessionExpiredError } from '../types/auth';

const CLAUDE_API_BASE = 'https://claude.ai';
const USAGE_ENDPOINT = '/api/usage';
const REQUEST_TIMEOUT_MS = 15_000;
const RATE_LIMIT_RETRY_MS = 5_000;

export interface WebApiFetcherConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export type HttpClient = (
  url: string,
  options: { headers: Record<string, string>; signal?: AbortSignal }
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

let httpClient: HttpClient | null = null;

export function setHttpClient(client: HttpClient | null): void {
  httpClient = client;
}

function getHttpClient(): HttpClient {
  if (httpClient) return httpClient;
  return (url, options) => fetch(url, options) as Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;
}

export class WebApiFetcher implements UsageFetcher {
  readonly type: FetcherType = 'webapi';

  private keychainManager: KeychainManager;
  private authManager: AuthenticationManager;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(
    keychainManager: KeychainManager,
    authManager: AuthenticationManager,
    config?: WebApiFetcherConfig,
  ) {
    this.keychainManager = keychainManager;
    this.authManager = authManager;
    this.baseUrl = config?.baseUrl ?? CLAUDE_API_BASE;
    this.timeoutMs = config?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  async fetch(): Promise<UsageData> {
    const session = await this.getValidSession();
    if (!session) {
      throw new SessionExpiredError('No valid authentication credentials available');
    }

    const loginSession = this.parseLoginSession(session);

    try {
      return await this.fetchUsageData(loginSession);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return this.handleAuthError(loginSession);
      }
      throw error;
    }
  }

  async isAuthenticationRequired(): Promise<boolean> {
    const valid = await this.keychainManager.isSessionValid();
    return !valid;
  }

  async authenticateRequest(
    headers: Record<string, string>
  ): Promise<Record<string, string>> {
    const session = await this.getValidSession();
    if (!session) {
      throw new SessionExpiredError('No valid session available for request authentication');
    }

    const loginSession = this.parseLoginSession(session);
    const authHeaders = this.buildHeaders(loginSession);

    return { ...headers, ...authHeaders };
  }

  private async getValidSession(): Promise<StoredSession | null> {
    const isValid = await this.keychainManager.isSessionValid();
    if (!isValid) return null;
    return this.keychainManager.retrieveSession();
  }

  private parseLoginSession(stored: StoredSession): LoginSession {
    const parsed = JSON.parse(stored.sessionData);
    return {
      cookies: parsed.cookies,
      sessionId: parsed.sessionId,
      expiresAt: parsed.expiresAt,
    };
  }

  private async fetchUsageData(session: LoginSession): Promise<UsageData> {
    const url = `${this.baseUrl}${USAGE_ENDPOINT}`;
    const headers = this.buildHeaders(session);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const client = getHttpClient();
      const response = await client(url, {
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(
          `Authentication failed with status ${response.status}`
        );
      }

      if (response.status === 429) {
        throw new RateLimitError('Rate limited by Claude API');
      }

      if (!response.ok) {
        throw new NetworkError(
          `API request failed with status ${response.status}`
        );
      }

      const data = await response.json();
      return this.parseUsageResponse(data);
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      if (error instanceof RateLimitError) throw error;
      if (error instanceof NetworkError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError(`Request timed out after ${this.timeoutMs}ms`);
      }

      throw new NetworkError(
        error instanceof Error ? error.message : 'Unknown network error'
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private buildHeaders(session: LoginSession): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (session.cookies) {
      headers['Cookie'] = session.cookies;
    }

    if (session.sessionId) {
      headers['Authorization'] = `Bearer ${session.sessionId}`;
    }

    return headers;
  }

  private parseUsageResponse(data: unknown): UsageData {
    const d = data as Record<string, unknown>;

    if (
      typeof d.tokensUsed !== 'number' ||
      typeof d.tokensLimit !== 'number' ||
      typeof d.messagesUsed !== 'number' ||
      typeof d.messagesLimit !== 'number'
    ) {
      throw new Error('Invalid usage data format from API');
    }

    return {
      tokensUsed: d.tokensUsed,
      tokensLimit: d.tokensLimit,
      messagesUsed: d.messagesUsed,
      messagesLimit: d.messagesLimit,
      resetTime: new Date(d.resetTime as string | number),
      lastUpdated: new Date(),
    };
  }

  private async handleAuthError(_session: LoginSession): Promise<UsageData> {
    await this.keychainManager.cleanupExpiredSession();

    try {
      const result = await this.authManager.refreshSession();
      if (!result.success || !result.session) {
        throw new SessionExpiredError('Re-authentication failed');
      }

      return this.fetchUsageData(result.session);
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      throw new SessionExpiredError(
        'Authentication refresh failed: ' +
          (error instanceof Error ? error.message : 'unknown error')
      );
    }
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export default WebApiFetcher;
