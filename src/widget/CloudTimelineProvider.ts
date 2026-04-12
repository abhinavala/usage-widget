import { CloudSyncManager } from '../services/CloudSyncManager';
import {
  UsageData,
  CloudSyncData,
  SyncError,
} from '../types/sync';

export enum WidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
}

export interface WidgetConfiguration {
  showTokens: boolean;
  showRequests: boolean;
  size: WidgetSize;
  refreshInterval: number;
}

export interface TimelineEntry {
  date: Date;
  usageData: UsageData;
  configuration: WidgetConfiguration;
}

export interface Timeline<T> {
  entries: T[];
  policy: { afterDate: Date };
}

export interface LocalDataSource {
  readUsageData(): Promise<UsageData | null>;
}

const TIMELINE_ENTRY_COUNT = 60;
const ENTRY_INTERVAL_MS = 60 * 1000; // 1 minute
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export class CloudTimelineProvider {
  private syncManager: CloudSyncManager;
  private localDataSource: LocalDataSource;

  constructor(syncManager: CloudSyncManager, localDataSource: LocalDataSource) {
    this.syncManager = syncManager;
    this.localDataSource = localDataSource;
  }

  async getUsageDataWithFallback(): Promise<UsageData | null> {
    try {
      const cloudData: CloudSyncData | null = await this.syncManager.readUsageData();

      if (cloudData && !this.isDataStale(cloudData.syncTimestamp)) {
        return cloudData.usageData;
      }

      // iCloud data is stale or null — fall back to local
      const localData = await this.localDataSource.readUsageData();
      if (localData) {
        return localData;
      }

      // If local is also null but we have stale cloud data, use it
      if (cloudData) {
        return cloudData.usageData;
      }

      return null;
    } catch (error) {
      if (error instanceof SyncError && error.recoverable) {
        // iCloud unavailable — fall back to local
        const localData = await this.localDataSource.readUsageData();
        return localData;
      }
      // Non-recoverable error — still try local
      const localData = await this.localDataSource.readUsageData();
      return localData;
    }
  }

  generateTimelineEntries(
    usageData: UsageData,
    configuration: WidgetConfiguration
  ): TimelineEntry[] {
    const now = new Date();
    const entries: TimelineEntry[] = [];

    for (let i = 0; i < TIMELINE_ENTRY_COUNT; i++) {
      entries.push({
        date: new Date(now.getTime() + i * ENTRY_INTERVAL_MS),
        usageData,
        configuration,
      });
    }

    return entries;
  }

  async getTimeline(configuration: WidgetConfiguration): Promise<Timeline<TimelineEntry>> {
    const usageData = await this.getUsageDataWithFallback();

    if (!usageData) {
      return {
        entries: [],
        policy: { afterDate: new Date(Date.now() + TIMELINE_ENTRY_COUNT * ENTRY_INTERVAL_MS) },
      };
    }

    const entries = this.generateTimelineEntries(usageData, configuration);

    return {
      entries,
      policy: { afterDate: new Date(Date.now() + TIMELINE_ENTRY_COUNT * ENTRY_INTERVAL_MS) },
    };
  }

  private isDataStale(timestamp: Date): boolean {
    const age = Date.now() - timestamp.getTime();
    return age > STALE_THRESHOLD_MS;
  }
}
