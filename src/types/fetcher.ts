import { UsageData } from './sync';

export type FetcherType = 'webapi' | 'cli';

export interface FetchResult {
  data: UsageData;
  success: boolean;
  error?: string;
  source: FetcherType;
}
