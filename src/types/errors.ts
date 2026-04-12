import type { FetcherType } from './fetcher';

export class AuthError extends Error {
  code: string;
  requiresReauth: boolean;

  constructor(message: string, code: string, requiresReauth: boolean = false) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.requiresReauth = requiresReauth;
  }
}

export class FetchError extends Error {
  code: string;
  fetcherType: FetcherType;
  retryable: boolean;

  constructor(
    message: string,
    code: string,
    fetcherType: FetcherType,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    this.fetcherType = fetcherType;
    this.retryable = retryable;
  }
}
