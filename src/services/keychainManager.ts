import { StoredSession, KeychainItem, StorageError, LoginSession } from '../types/storage';

const SERVICE_NAME = 'com.claude.widget';
const ACCOUNT_NAME = 'session';
const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes stale threshold

interface KeychainBinding {
  setPassword(opts: { account: string; service: string; password: string }): Promise<void>;
  getPassword(opts: { account: string; service: string }): Promise<string>;
  deletePassword(opts: { account: string; service: string }): Promise<void>;
}

let keychainBinding: KeychainBinding | null = null;

function getKeychain(): KeychainBinding {
  if (!keychainBinding) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const keychain = require('node-keychain');
      keychainBinding = {
        setPassword: (opts) =>
          new Promise<void>((resolve, reject) => {
            keychain.setPassword(opts, (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            });
          }),
        getPassword: (opts) =>
          new Promise<string>((resolve, reject) => {
            keychain.getPassword(opts, (err: Error | null, password: string) => {
              if (err) reject(err);
              else resolve(password);
            });
          }),
        deletePassword: (opts) =>
          new Promise<void>((resolve, reject) => {
            keychain.deletePassword(opts, (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            });
          }),
      };
    } catch {
      throw new StorageError('node-keychain module not available', 'init');
    }
  }
  return keychainBinding;
}

/** Allows injecting a mock keychain for testing */
export function setKeychainBinding(binding: KeychainBinding | null): void {
  keychainBinding = binding;
}

export class KeychainManager {
  private service: string;
  private account: string;

  constructor(service: string = SERVICE_NAME, account: string = ACCOUNT_NAME) {
    this.service = service;
    this.account = account;
  }

  async storeSession(session: LoginSession): Promise<void> {
    const storedSession: StoredSession = {
      sessionData: JSON.stringify({
        cookies: session.cookies,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      }),
      timestamp: Date.now(),
      isValid: true,
    };

    const item: KeychainItem = {
      service: this.service,
      account: this.account,
      data: JSON.stringify(storedSession),
    };

    try {
      const keychain = getKeychain();
      await keychain.setPassword({
        account: item.account,
        service: item.service,
        password: item.data,
      });
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        'Failed to store session in keychain',
        'store'
      );
    }
  }

  async retrieveSession(): Promise<StoredSession | null> {
    try {
      const keychain = getKeychain();
      const data = await keychain.getPassword({
        account: this.account,
        service: this.service,
      });

      if (!data) return null;

      const stored: StoredSession = JSON.parse(data);
      return stored;
    } catch {
      return null;
    }
  }

  async deleteSession(): Promise<void> {
    try {
      const keychain = getKeychain();
      await keychain.deletePassword({
        account: this.account,
        service: this.service,
      });
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        'Failed to delete session from keychain',
        'delete'
      );
    }
  }

  async isSessionValid(): Promise<boolean> {
    const session = await this.retrieveSession();
    if (!session || !session.isValid) return false;

    const age = Date.now() - session.timestamp;
    if (age > SESSION_EXPIRY_MS) return false;

    try {
      const parsed = JSON.parse(session.sessionData);
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) return false;
    } catch {
      return false;
    }

    return true;
  }

  async cleanupExpiredSession(): Promise<void> {
    const valid = await this.isSessionValid();
    if (!valid) {
      try {
        await this.deleteSession();
      } catch {
        // Session may already be gone; ignore
      }
    }
  }
}

export default KeychainManager;
