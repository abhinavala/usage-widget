export interface StoredSession {
  sessionData: string;
  timestamp: number;
  isValid: boolean;
}

export interface KeychainItem {
  service: string;
  account: string;
  data: string;
}

export class StorageError extends Error {
  operation: string;

  constructor(message: string, operation: string) {
    super(message);
    this.name = 'StorageError';
    this.operation = operation;
  }
}

export interface LoginSession {
  cookies: string;
  sessionId: string;
  expiresAt: number;
}
