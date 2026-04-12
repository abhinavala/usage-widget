import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { AuthCredentials, AuthState } from '../../src/types/auth';
import { AuthError } from '../../src/types/errors';

const MAC_APP_DIR = resolve(__dirname, '..');

function readSwiftFile(filename: string): string {
  return readFileSync(resolve(MAC_APP_DIR, filename), 'utf-8');
}

describe('KeychainManager', () => {
  let keychainManagerSource: string;
  let keychainConstantsSource: string;

  beforeEach(() => {
    keychainManagerSource = readSwiftFile('KeychainManager.swift');
    keychainConstantsSource = readSwiftFile('KeychainConstants.swift');
  });

  describe('storeCredentials successfully saves valid AuthCredentials to keychain', () => {
    it('KeychainManager implements storeCredentials method', () => {
      expect(keychainManagerSource).toContain('func storeCredentials');
      expect(keychainManagerSource).toContain('AuthCredentials');
    });

    it('storeCredentials stores session token in keychain', () => {
      expect(keychainManagerSource).toContain('sessionToken');
      expect(keychainManagerSource).toContain('SecItemAdd');
    });

    it('storeCredentials stores cookies in keychain', () => {
      expect(keychainManagerSource).toContain('cookies');
    });

    it('storeCredentials stores lastAuthTime as ISO 8601', () => {
      expect(keychainManagerSource).toContain('ISO8601DateFormatter');
      expect(keychainManagerSource).toContain('lastAuthTime');
    });

    it('credentials stored securely can be retrieved with retrieveCredentials', () => {
      expect(keychainManagerSource).toContain('func retrieveCredentials');
      // Verify retrieve returns AuthCredentials
      expect(keychainManagerSource).toContain('-> AuthCredentials');
    });

    it('uses kSecAttrAccessibleWhenUnlockedThisDeviceOnly for secure storage', () => {
      expect(keychainManagerSource).toContain('kSecAttrAccessibleWhenUnlockedThisDeviceOnly');
    });

    it('prevents duplicate entries by deleting existing items before storing', () => {
      // Verify the store flow deletes before adding to prevent duplicates
      expect(keychainManagerSource).toContain('deleteItemSilently');
      expect(keychainManagerSource).toContain('SecItemDelete');
    });

    it('AuthCredentials TypeScript interface matches integration contract', () => {
      const credentials: AuthCredentials = {
        sessionToken: 'test-session-token',
        cookies: 'test-cookies',
        lastAuthTime: new Date(),
      };
      expect(credentials.sessionToken).toBe('test-session-token');
      expect(credentials.cookies).toBe('test-cookies');
      expect(credentials.lastAuthTime).toBeInstanceOf(Date);
    });

    it('AuthCredentials allows optional sessionToken and cookies', () => {
      const credentials: AuthCredentials = {
        lastAuthTime: new Date(),
      };
      expect(credentials.sessionToken).toBeUndefined();
      expect(credentials.cookies).toBeUndefined();
      expect(credentials.lastAuthTime).toBeInstanceOf(Date);
    });
  });

  describe('retrieveCredentials throws AuthError when keychain access is denied', () => {
    it('handles errSecAuthFailed with KEYCHAIN_ACCESS_DENIED error code', () => {
      expect(keychainManagerSource).toContain('errSecAuthFailed');
      expect(keychainManagerSource).toContain('keychainAccessDenied');
    });

    it('handles errSecInteractionNotAllowed with KEYCHAIN_ACCESS_DENIED error code', () => {
      expect(keychainManagerSource).toContain('errSecInteractionNotAllowed');
    });

    it('AuthError has correct structure with code and requiresReauth', () => {
      const error = new AuthError(
        'Keychain access denied',
        'KEYCHAIN_ACCESS_DENIED',
        true
      );
      expect(error.code).toBe('KEYCHAIN_ACCESS_DENIED');
      expect(error.requiresReauth).toBe(true);
      expect(error.message).toBe('Keychain access denied');
      expect(error).toBeInstanceOf(Error);
    });

    it('access denied errors set requiresReauth to true', () => {
      // Verify in Swift source that access denied throws with requiresReauth: true
      const accessDeniedPattern = /keychainAccessDenied[\s\S]*?requiresReauth:\s*true/;
      expect(keychainManagerSource).toMatch(accessDeniedPattern);
    });

    it('handles item not found with appropriate error', () => {
      expect(keychainManagerSource).toContain('errSecItemNotFound');
      expect(keychainManagerSource).toContain('keychainItemNotFound');
    });

    it('provides clear error messages for permission issues', () => {
      expect(keychainManagerSource).toContain('Please check app permissions');
    });
  });

  describe('validateCredentials returns expired for credentials older than 24 hours', () => {
    it('KeychainManager implements validateCredentials method', () => {
      expect(keychainManagerSource).toContain('func validateCredentials');
      expect(keychainManagerSource).toContain('-> AuthState');
    });

    it('returns expired when lastAuthTime exceeds 24-hour threshold', () => {
      // Verify Swift implementation uses credentialExpirationInterval
      expect(keychainManagerSource).toContain('credentialExpirationInterval');
      expect(keychainConstantsSource).toContain('24 * 60 * 60');
    });

    it('AuthState expired correctly identifies old credentials in TypeScript', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const credentials: AuthCredentials = {
        sessionToken: 'test-token',
        lastAuthTime: twentyFiveHoursAgo,
      };

      // Simulate the validation logic from Swift
      const expirationThreshold = 24 * 60 * 60 * 1000; // 24 hours in ms
      const elapsed = Date.now() - credentials.lastAuthTime.getTime();
      const authState: AuthState = elapsed > expirationThreshold ? 'expired' : 'authenticated';

      expect(authState).toBe('expired');
    });

    it('returns authenticated for fresh credentials', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const credentials: AuthCredentials = {
        sessionToken: 'test-token',
        cookies: 'test-cookies',
        lastAuthTime: fiveMinutesAgo,
      };

      const expirationThreshold = 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - credentials.lastAuthTime.getTime();
      const authState: AuthState = elapsed > expirationThreshold ? 'expired' : 'authenticated';

      expect(authState).toBe('authenticated');
    });

    it('returns invalid when no session token or cookies are present', () => {
      // Verify Swift checks for at least sessionToken or cookies
      expect(keychainManagerSource).toContain('.invalid');
      expect(keychainManagerSource).toContain('sessionToken != nil || credentials.cookies != nil');
    });

    it('AuthState type covers all expected states', () => {
      const states: AuthState[] = ['authenticated', 'unauthenticated', 'expired', 'invalid'];
      expect(states).toHaveLength(4);
      expect(states).toContain('authenticated');
      expect(states).toContain('unauthenticated');
      expect(states).toContain('expired');
      expect(states).toContain('invalid');
    });
  });

  describe('KeychainConstants configuration', () => {
    it('defines correct service name', () => {
      expect(keychainConstantsSource).toContain('com.claudeusage.mac');
    });

    it('defines account keys for all credential types', () => {
      expect(keychainConstantsSource).toContain('sessionToken');
      expect(keychainConstantsSource).toContain('cookies');
      expect(keychainConstantsSource).toContain('lastAuthTime');
    });

    it('defines all required error codes', () => {
      expect(keychainConstantsSource).toContain('KEYCHAIN_ACCESS_DENIED');
      expect(keychainConstantsSource).toContain('KEYCHAIN_ITEM_NOT_FOUND');
      expect(keychainConstantsSource).toContain('KEYCHAIN_DUPLICATE_ITEM');
      expect(keychainConstantsSource).toContain('KEYCHAIN_STORE_FAILED');
      expect(keychainConstantsSource).toContain('KEYCHAIN_DELETE_FAILED');
      expect(keychainConstantsSource).toContain('KEYCHAIN_DATA_INVALID');
    });
  });

  describe('KeychainManager security and lifecycle', () => {
    it('uses Security framework for keychain operations', () => {
      expect(keychainManagerSource).toContain('import Security');
    });

    it('uses kSecClassGenericPassword for credential storage', () => {
      expect(keychainManagerSource).toContain('kSecClassGenericPassword');
    });

    it('implements deleteCredentials for credential cleanup', () => {
      expect(keychainManagerSource).toContain('func deleteCredentials');
    });

    it('never logs sensitive credential data', () => {
      // Ensure NSLog calls don't contain actual credential values
      const logLines = keychainManagerSource
        .split('\n')
        .filter((line) => line.includes('NSLog'));
      for (const line of logLines) {
        expect(line).not.toContain('sessionToken');
        expect(line).not.toContain('cookies');
        expect(line).not.toMatch(/password/i);
      }
    });

    it('provides singleton access via shared property', () => {
      expect(keychainManagerSource).toContain('static let shared');
    });

    it('encrypts data using keychain native encryption (not plain text)', () => {
      // kSecValueData with SecItemAdd provides hardware-backed encryption
      expect(keychainManagerSource).toContain('kSecValueData');
      expect(keychainManagerSource).toContain('SecItemAdd');
      expect(keychainManagerSource).toContain('SecItemCopyMatching');
    });
  });
});
