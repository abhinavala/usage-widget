import { LoginSession } from './storage';

export interface LoginResult {
  success: boolean;
  session?: LoginSession;
  error?: string;
}

export enum LoginState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

export class LoginError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LoginError';
    this.code = code;
  }
}

export class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
