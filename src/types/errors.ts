export class UsageFetchError extends Error {
  code: string;
  retryable: boolean;

  constructor(message: string, code: string, retryable: boolean = false) {
    super(message);
    this.name = 'UsageFetchError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class SyncError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
