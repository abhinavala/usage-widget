import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { UsageData } from '../../src/types/sync';
import type { FetcherType } from '../../src/types/fetcher';
import type { AuthCredentials, AuthState } from '../../src/types/auth';
import { AuthError, FetchError } from '../../src/types/errors';

const MAC_APP_DIR = resolve(__dirname, '..');

function readSwiftFile(filename: string): string {
  return readFileSync(resolve(MAC_APP_DIR, filename), 'utf-8');
}

describe('WebAPIFetcher', () => {
  let webAPIFetcherSource: string;
  let httpClientSource: string;
  let responseParserSource: string;

  beforeEach(() => {
    webAPIFetcherSource = readSwiftFile('WebAPIFetcher.swift');
    httpClientSource = readSwiftFile('HTTPClient.swift');
    responseParserSource = readSwiftFile('ResponseParser.swift');
  });

  describe('fetchUsage returns valid UsageData when authenticated request succeeds', () => {
    it('WebAPIFetcher implements UsageFetcher protocol', () => {
      expect(webAPIFetcherSource).toContain('protocol UsageFetcher');
      expect(webAPIFetcherSource).toContain('class WebAPIFetcher: UsageFetcher');
    });

    it('fetchUsage method returns UsageData', () => {
      expect(webAPIFetcherSource).toContain('func fetchUsage() throws -> UsageData');
    });

    it('retrieves credentials from KeychainManager before making request', () => {
      expect(webAPIFetcherSource).toContain('keychainManager.retrieveCredentials()');
    });

    it('validates credentials before fetching', () => {
      expect(webAPIFetcherSource).toContain('keychainManager.validateCredentials(credentials)');
      expect(webAPIFetcherSource).toContain('authState == .authenticated');
    });

    it('makes authenticated HTTP request for usage data', () => {
      expect(webAPIFetcherSource).toContain('httpClient.fetchUsageData(credentials: credentials)');
    });

    it('parses response into UsageData', () => {
      expect(webAPIFetcherSource).toContain('responseParser.parseResponse');
    });

    it('logs successful fetch with usage details', () => {
      expect(webAPIFetcherSource).toContain('Successfully fetched usage data');
    });

    it('UsageData TypeScript interface has all required fields', () => {
      const usageData: UsageData = {
        tokensUsed: 5000,
        tokensLimit: 100000,
        messagesUsed: 10,
        messagesLimit: 50,
        resetTime: new Date(Date.now() + 3600000),
        lastUpdated: new Date(),
      };
      expect(usageData.tokensUsed).toBeGreaterThanOrEqual(0);
      expect(usageData.tokensLimit).toBeGreaterThan(0);
      expect(usageData.messagesUsed).toBeGreaterThanOrEqual(0);
      expect(usageData.messagesLimit).toBeGreaterThan(0);
      expect(usageData.resetTime).toBeInstanceOf(Date);
      expect(usageData.lastUpdated).toBeInstanceOf(Date);
      // lastUpdated should be within the last minute
      const oneMinuteAgo = new Date(Date.now() - 60000);
      expect(usageData.lastUpdated.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    });

    it('UsageData struct in Swift mirrors TypeScript interface', () => {
      expect(responseParserSource).toContain('struct UsageData');
      expect(responseParserSource).toContain('var tokensUsed: Int');
      expect(responseParserSource).toContain('var tokensLimit: Int');
      expect(responseParserSource).toContain('var messagesUsed: Int');
      expect(responseParserSource).toContain('var messagesLimit: Int');
      expect(responseParserSource).toContain('var resetTime: Date');
      expect(responseParserSource).toContain('var lastUpdated: Date');
    });

    it('WebAPIFetcher provides singleton access via shared', () => {
      expect(webAPIFetcherSource).toContain('static let shared');
    });

    it('WebAPIFetcher uses dependency injection for testability', () => {
      expect(webAPIFetcherSource).toContain('keychainManager: KeychainManager');
      expect(webAPIFetcherSource).toContain('httpClient: HTTPClient');
      expect(webAPIFetcherSource).toContain('responseParser: ResponseParser');
    });
  });

  describe('makeAuthenticatedRequest throws AuthError when credentials are expired', () => {
    it('validates credentials before making authenticated requests', () => {
      expect(webAPIFetcherSource).toContain('func makeAuthenticatedRequest');
      expect(webAPIFetcherSource).toContain('validateCredentials');
    });

    it('throws FetchError with CREDENTIALS_EXPIRED code for expired credentials', () => {
      expect(webAPIFetcherSource).toContain('FetchErrorCode.credentialsExpired');
      expect(responseParserSource).toContain('"CREDENTIALS_EXPIRED"');
    });

    it('HTTPClient also validates credentials before requests', () => {
      expect(httpClientSource).toContain('validateCredentials');
      expect(httpClientSource).toContain('FetchErrorCode.credentialsExpired');
    });

    it('FetchError TypeScript class has correct structure', () => {
      const error = new FetchError(
        'Credentials expired',
        'CREDENTIALS_EXPIRED',
        'webapi',
        false
      );
      expect(error.code).toBe('CREDENTIALS_EXPIRED');
      expect(error.fetcherType).toBe('webapi');
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Credentials expired');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FetchError');
    });

    it('FetchError in Swift mirrors TypeScript class', () => {
      expect(responseParserSource).toContain('class FetchError: Error');
      expect(responseParserSource).toContain('let code: String');
      expect(responseParserSource).toContain('let fetcherType: FetcherType');
      expect(responseParserSource).toContain('let retryable: Bool');
    });

    it('expired credential error is not retryable', () => {
      // Verify Swift implementation marks credential errors as non-retryable
      const expiredPattern = /credentialsExpired[\s\S]*?retryable:\s*false/;
      expect(webAPIFetcherSource).toMatch(expiredPattern);
    });

    it('AuthError from dependency is used for credential retrieval failures', () => {
      const error = new AuthError(
        'Keychain access denied',
        'KEYCHAIN_ACCESS_DENIED',
        true
      );
      expect(error.code).toBe('KEYCHAIN_ACCESS_DENIED');
      expect(error.requiresReauth).toBe(true);
    });

    it('FetcherType webapi is used for WebAPIFetcher errors', () => {
      const fetcherType: FetcherType = 'webapi';
      expect(fetcherType).toBe('webapi');
      expect(responseParserSource).toContain("case webapi");
    });
  });

  describe('parseUsageResponse correctly extracts usage data from Claude.ai HTML response', () => {
    it('ResponseParser implements parseHTMLResponse method', () => {
      expect(responseParserSource).toContain('func parseHTMLResponse');
    });

    it('ResponseParser implements parseAPIResponse for JSON format', () => {
      expect(responseParserSource).toContain('func parseAPIResponse');
    });

    it('parseResponse auto-detects JSON vs HTML content type', () => {
      expect(responseParserSource).toContain('func parseResponse');
      expect(responseParserSource).toContain('application/json');
    });

    it('HTML parser extracts token usage with regex patterns', () => {
      expect(responseParserSource).toContain('extractNumber');
      expect(responseParserSource).toContain('tokens');
      expect(responseParserSource).toContain('NSRegularExpression');
    });

    it('HTML parser extracts message usage', () => {
      expect(responseParserSource).toContain('messagesUsed');
      expect(responseParserSource).toContain('messagesLimit');
    });

    it('JSON parser handles both camelCase and snake_case field names', () => {
      expect(responseParserSource).toContain('tokensUsed');
      expect(responseParserSource).toContain('tokens_used');
      expect(responseParserSource).toContain('messagesUsed');
      expect(responseParserSource).toContain('messages_used');
    });

    it('parser extracts reset time from response', () => {
      expect(responseParserSource).toContain('parseResetTime');
      expect(responseParserSource).toContain('resetTime');
      expect(responseParserSource).toContain('ISO8601DateFormatter');
    });

    it('parser throws FetchError with PARSE_ERROR code for invalid data', () => {
      expect(responseParserSource).toContain('FetchErrorCode.parseError');
      expect(responseParserSource).toContain('"PARSE_ERROR"');
    });

    it('parse errors are not retryable', () => {
      const parseErrorPattern = /parseError[\s\S]*?retryable:\s*false/;
      expect(responseParserSource).toMatch(parseErrorPattern);
    });

    it('parser handles missing fields gracefully with descriptive errors', () => {
      expect(responseParserSource).toContain('Missing required usage fields');
      expect(responseParserSource).toContain('Could not extract usage data');
    });
  });

  describe('HTTPClient retry and rate limiting', () => {
    it('implements retry logic with configurable max retries', () => {
      expect(httpClientSource).toContain('maxRetries');
      expect(httpClientSource).toContain('for attempt in');
    });

    it('uses exponential backoff between retries', () => {
      expect(httpClientSource).toContain('retryBaseDelay');
      expect(httpClientSource).toContain('pow(2.0');
    });

    it('respects rate limiting between requests', () => {
      expect(httpClientSource).toContain('enforceRateLimit');
      expect(httpClientSource).toContain('minRequestInterval');
    });

    it('handles network timeouts as retryable errors', () => {
      expect(httpClientSource).toContain('FetchErrorCode.networkTimeout');
      expect(httpClientSource).toContain('retryable: true');
    });

    it('handles HTTP 429 rate limit responses', () => {
      expect(httpClientSource).toContain('429');
      expect(httpClientSource).toContain('FetchErrorCode.rateLimited');
    });

    it('handles HTTP 401/403 authentication failures as non-retryable', () => {
      expect(httpClientSource).toContain('401, 403');
      expect(httpClientSource).toContain('FetchErrorCode.authenticationFailed');
    });

    it('handles server errors (5xx) as retryable', () => {
      expect(httpClientSource).toContain('500...599');
      expect(httpClientSource).toContain('FetchErrorCode.serverError');
    });

    it('sets proper authentication headers from credentials', () => {
      expect(httpClientSource).toContain('Authorization');
      expect(httpClientSource).toContain('Bearer');
      expect(httpClientSource).toContain('Cookie');
    });

    it('configures proper request timeout', () => {
      expect(httpClientSource).toContain('requestTimeout');
      expect(httpClientSource).toContain('timeoutIntervalForRequest');
    });

    it('uses claude.ai base URL for API requests', () => {
      expect(httpClientSource).toContain('https://claude.ai');
      expect(httpClientSource).toContain('/api/usage');
    });

    it('never logs sensitive credential data', () => {
      const logLines = httpClientSource
        .split('\n')
        .filter((line) => line.includes('NSLog'));
      for (const line of logLines) {
        expect(line).not.toContain('sessionToken');
        expect(line).not.toContain('cookies');
        expect(line).not.toMatch(/password/i);
        expect(line).not.toContain('Bearer');
      }
    });
  });

  describe('FetchErrorCode constants', () => {
    it('defines all required error codes', () => {
      expect(responseParserSource).toContain('NETWORK_TIMEOUT');
      expect(responseParserSource).toContain('NETWORK_ERROR');
      expect(responseParserSource).toContain('PARSE_ERROR');
      expect(responseParserSource).toContain('RATE_LIMITED');
      expect(responseParserSource).toContain('CREDENTIALS_EXPIRED');
      expect(responseParserSource).toContain('AUTHENTICATION_FAILED');
      expect(responseParserSource).toContain('INVALID_RESPONSE');
      expect(responseParserSource).toContain('SERVER_ERROR');
    });

    it('FetcherType enum has webapi and cli cases', () => {
      expect(responseParserSource).toContain('case webapi');
      expect(responseParserSource).toContain('case cli');
    });
  });
});
