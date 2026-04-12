import { UsageData } from './usage';

export type FetcherType = 'webapi' | 'cli';

export interface UsageFetcher {
  fetchUsage(): Promise<UsageData>;
}

export interface FetcherConfig {
  type: FetcherType;
  timeout: number;
  retryAttempts: number;
}

export interface FetchResult {
  data: UsageData;
  success: boolean;
  error?: string;
  source: FetcherType;
}
