import {
  UsageData,
  SyncState,
  CloudSyncData,
  SyncStatusEnum,
  SyncError,
} from '../types/sync';

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const ICLOUD_USAGE_KEY = 'com.claudeusage.syncData';

export interface ICloudStore {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  synchronize(): boolean;
  isAvailable(): boolean;
}

export class CloudSyncManager {
  private store: ICloudStore;
  private deviceId: string;
  private lastSyncState: SyncState;

  constructor(store: ICloudStore, deviceId: string) {
    this.store = store;
    this.deviceId = deviceId;
    this.lastSyncState = {
      lastSyncTime: new Date(0),
      isStale: true,
    };
  }

  async writeUsageData(data: UsageData): Promise<SyncStatusEnum> {
    if (!this.store.isAvailable()) {
      this.lastSyncState = {
        ...this.lastSyncState,
        syncError: 'iCloud is not available',
      };
      throw new SyncError(
        'iCloud is not available',
        'ICLOUD_UNAVAILABLE',
        'write',
        true
      );
    }

    const syncData: CloudSyncData = {
      usageData: data,
      syncTimestamp: new Date(),
      deviceId: this.deviceId,
    };

    const serialized = this.serialize(syncData);

    const success = this.store.set(ICLOUD_USAGE_KEY, serialized);
    if (!success) {
      this.lastSyncState = {
        ...this.lastSyncState,
        syncError: 'Failed to write to iCloud store',
      };
      throw new SyncError(
        'Failed to write to iCloud store',
        'WRITE_FAILED',
        'write',
        true
      );
    }

    this.store.synchronize();

    this.lastSyncState = {
      lastSyncTime: new Date(),
      isStale: false,
      syncError: undefined,
    };

    return SyncStatusEnum.SUCCESS;
  }

  async readUsageData(): Promise<CloudSyncData | null> {
    if (!this.store.isAvailable()) {
      this.lastSyncState = {
        ...this.lastSyncState,
        syncError: 'iCloud is not available',
      };
      throw new SyncError(
        'iCloud is not available',
        'ICLOUD_UNAVAILABLE',
        'read',
        true
      );
    }

    this.store.synchronize();

    const raw = this.store.get(ICLOUD_USAGE_KEY);
    if (raw === null) {
      return null;
    }

    const syncData = this.deserialize(raw);

    this.lastSyncState = {
      lastSyncTime: new Date(),
      isStale: this.isDataStale(syncData.syncTimestamp),
      syncError: undefined,
    };

    return syncData;
  }

  isDataStale(timestamp: Date): boolean {
    const age = Date.now() - timestamp.getTime();
    return age > STALE_THRESHOLD_MS;
  }

  getSyncState(): SyncState {
    return { ...this.lastSyncState };
  }

  private serialize(data: CloudSyncData): string {
    return JSON.stringify({
      usageData: {
        ...data.usageData,
        resetTime: data.usageData.resetTime.toISOString(),
        lastUpdated: data.usageData.lastUpdated.toISOString(),
      },
      syncTimestamp: data.syncTimestamp.toISOString(),
      deviceId: data.deviceId,
    });
  }

  private deserialize(raw: string): CloudSyncData {
    try {
      const parsed = JSON.parse(raw);
      return {
        usageData: {
          ...parsed.usageData,
          resetTime: new Date(parsed.usageData.resetTime),
          lastUpdated: new Date(parsed.usageData.lastUpdated),
        },
        syncTimestamp: new Date(parsed.syncTimestamp),
        deviceId: parsed.deviceId,
      };
    } catch {
      throw new SyncError(
        'Failed to deserialize sync data',
        'DESERIALIZE_FAILED',
        'read',
        false
      );
    }
  }
}
