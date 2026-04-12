import { UsageData } from './usage';

export interface UsageFetcher {
  fetchUsage(): Promise<UsageData>;
}

export type FetcherType = 'webapi' | 'cli';

export interface FetcherConfig {
  type: FetcherType;
  timeout: number;
  retryAttempts: number;
}
