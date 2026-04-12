import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeychainManager, setKeychainBinding } from '../../services/keychainManager';
import { StorageError, LoginSession } from '../../types/storage';

function createMockKeychain() {
  const store = new Map<string, string>();
  return {
    store,
    setPassword: vi.fn(async (opts: { account: string; service: string; password: string }) => {
      store.set(`${opts.service}:${opts.account}`, opts.password);
    }),
    getPassword: vi.fn(async (opts: { account: string; service: string }) => {
      const value = store.get(`${opts.service}:${opts.account}`);
      if (!value) throw new Error('Could not find password');
      return value;
    }),
    deletePassword: vi.fn(async (opts: { account: string; service: string }) => {
      store.delete(`${opts.service}:${opts.account}`);
    }),
  };
}

describe('KeychainManager', () => {
  let manager: KeychainManager;
  let mockKeychain: ReturnType<typeof createMockKeychain>;

  beforeEach(() => {
    mockKeychain = createMockKeychain();
    setKeychainBinding(mockKeychain);
    manager = new KeychainManager('test.service', 'test.account');
  });

  const validSession: LoginSession = {
    cookies: 'session_cookie=abc123',
    sessionId: 'sess_001',
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  };

  describe('storeSession', () => {
    it('successfully stores valid LoginSession in keychain', async () => {
      await manager.storeSession(validSession);

      expect(mockKeychain.setPassword).toHaveBeenCalledOnce();
      expect(mockKeychain.setPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          account: 'test.account',
          service: 'test.service',
        })
      );

      // Verify data can be retrieved
      const retrieved = await manager.retrieveSession();
      expect(retrieved).not.toBeNull();
      expect(retrieved!.isValid).toBe(true);
      expect(retrieved!.timestamp).toBeGreaterThan(0);

      const sessionData = JSON.parse(retrieved!.sessionData);
      expect(sessionData.cookies).toBe(validSession.cookies);
      expect(sessionData.sessionId).toBe(validSession.sessionId);
      expect(sessionData.expiresAt).toBe(validSession.expiresAt);
    });

    it('throws StorageError when keychain access fails', async () => {
      mockKeychain.setPassword.mockRejectedValueOnce(new Error('Keychain locked'));

      try {
        await manager.storeSession(validSession);
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).operation).toBe('store');
      }
    });
  });

  describe('retrieveSession', () => {
    it('returns stored session after storeSession', async () => {
      await manager.storeSession(validSession);
      const retrieved = await manager.retrieveSession();

      expect(retrieved).not.toBeNull();
      expect(retrieved!.isValid).toBe(true);
      expect(typeof retrieved!.sessionData).toBe('string');
      expect(typeof retrieved!.timestamp).toBe('number');
    });

    it('returns null when no session is stored', async () => {
      const retrieved = await manager.retrieveSession();
      expect(retrieved).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('returns true for a fresh valid session', async () => {
      await manager.storeSession(validSession);
      const valid = await manager.isSessionValid();
      expect(valid).toBe(true);
    });

    it('returns false when no session is stored', async () => {
      const valid = await manager.isSessionValid();
      expect(valid).toBe(false);
    });

    it('returns false when session has expired expiresAt', async () => {
      const expiredSession: LoginSession = {
        cookies: 'expired_cookie',
        sessionId: 'sess_expired',
        expiresAt: Date.now() - 1000, // already expired
      };

      await manager.storeSession(expiredSession);
      const valid = await manager.isSessionValid();
      expect(valid).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('removes stored session', async () => {
      await manager.storeSession(validSession);
      await manager.deleteSession();

      const retrieved = await manager.retrieveSession();
      expect(retrieved).toBeNull();
    });

    it('throws StorageError when delete fails', async () => {
      mockKeychain.deletePassword.mockRejectedValueOnce(new Error('Keychain locked'));

      try {
        await manager.deleteSession();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).operation).toBe('delete');
      }
    });
  });

  describe('cleanupExpiredSession', () => {
    it('deletes expired session', async () => {
      const expiredSession: LoginSession = {
        cookies: 'old_cookie',
        sessionId: 'sess_old',
        expiresAt: Date.now() - 1000,
      };

      await manager.storeSession(expiredSession);
      await manager.cleanupExpiredSession();

      const retrieved = await manager.retrieveSession();
      expect(retrieved).toBeNull();
    });

    it('keeps valid session', async () => {
      await manager.storeSession(validSession);
      await manager.cleanupExpiredSession();

      const retrieved = await manager.retrieveSession();
      expect(retrieved).not.toBeNull();
    });
  });

  describe('sensitive data handling', () => {
    it('StorageError does not expose sensitive data in message', async () => {
      mockKeychain.setPassword.mockRejectedValueOnce(new Error('secret token abc123'));

      try {
        await manager.storeSession(validSession);
      } catch (error) {
        expect(error).toBeInstanceOf(StorageError);
        expect((error as StorageError).message).not.toContain('abc123');
        expect((error as StorageError).message).toBe('Failed to store session in keychain');
      }
    });
  });
});
