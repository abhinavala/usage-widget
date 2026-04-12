import { UsageData, SyncStatusEnum, SyncError } from '../types/sync';
import { FetchResult, FetcherType } from '../types/fetcher';
import { LaunchAgentConfig } from '../types/daemon';
import { CloudSyncManager } from './CloudSyncManager';

export type { FetchResult, FetcherType, LaunchAgentConfig };

export interface UsageFetcher {
  fetch(): Promise<UsageData>;
  type: FetcherType;
}

const DEFAULT_RETRY_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;

export class MacFetchService {
  private fetcher: UsageFetcher;
  private syncManager: CloudSyncManager;
  private config: LaunchAgentConfig;

  constructor(
    fetcher: UsageFetcher,
    syncManager: CloudSyncManager,
    config: LaunchAgentConfig = {
      keepAlive: true,
      fetchInterval: 5 * 60 * 1000,
      isUIElement: true,
    }
  ) {
    this.fetcher = fetcher;
    this.syncManager = syncManager;
    this.config = config;
  }

  async fetchAndSync(): Promise<FetchResult> {
    let data: UsageData;

    try {
      data = await this.fetcher.fetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown fetch error';
      return {
        data: {} as UsageData,
        success: false,
        error: message,
        source: this.fetcher.type,
      };
    }

    await this.handleFetchSuccess(data);

    return {
      data,
      success: true,
      source: this.fetcher.type,
    };
  }

  async handleFetchSuccess(data: UsageData): Promise<void> {
    try {
      await this.retrySyncWithBackoff(data);
      console.log(`[MacFetchService] iCloud sync succeeded for ${this.fetcher.type} fetcher`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error';
      console.warn(`[MacFetchService] iCloud sync failed, local data preserved: ${message}`);
    }
  }

  async retrySyncWithBackoff(
    data: UsageData,
    maxAttempts: number = DEFAULT_RETRY_ATTEMPTS
  ): Promise<SyncStatusEnum> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.syncManager.writeUsageData(data);
        return status;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof SyncError && !err.recoverable) {
          throw err;
        }

        if (attempt < maxAttempts - 1) {
          const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Sync failed after retries');
  }

  getConfig(): LaunchAgentConfig {
    return { ...this.config };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
