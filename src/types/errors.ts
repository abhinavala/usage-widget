import { FetcherType } from './fetcher';

export class FetchError extends Error {
  code: string;
  fetcherType: FetcherType;
  retryable: boolean;

  constructor(message: string, code: string, fetcherType: FetcherType, retryable: boolean = false) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    this.fetcherType = fetcherType;
    this.retryable = retryable;
  }
}
