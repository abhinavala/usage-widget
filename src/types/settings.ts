import type { FetcherType } from './fetcher';

export interface AppSettings {
  fetchInterval: number;
  staleThreshold: number;
  autoFetch: boolean;
  selectedFetcher: FetcherType;
}
