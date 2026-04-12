import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudTimelineProvider,
  WidgetSize,
  WidgetConfiguration,
  LocalDataSource,
} from '../../widget/CloudTimelineProvider';
import { CloudSyncManager, ICloudStore } from '../../services/CloudSyncManager';
import { UsageData, CloudSyncData, SyncError } from '../../types/sync';

function createMockStore(overrides: Partial<ICloudStore> = {}): ICloudStore {
  return {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn().mockReturnValue(true),
    synchronize: vi.fn().mockReturnValue(true),
    isAvailable: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

function createUsageData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    tokensUsed: 5000,
    tokensLimit: 100000,
    messagesUsed: 25,
    messagesLimit: 500,
    resetTime: new Date('2026-04-12T00:00:00Z'),
    lastUpdated: new Date(),
    ...overrides,
  };
}

function createMockLocalDataSource(data: UsageData | null = null): LocalDataSource {
  return {
    readUsageData: vi.fn().mockResolvedValue(data),
  };
}

function createSmallConfig(): WidgetConfiguration {
  return {
    showTokens: true,
    showRequests: true,
    size: WidgetSize.SMALL,
    refreshInterval: 60,
  };
}

function createMediumConfig(): WidgetConfiguration {
  return {
    showTokens: true,
    showRequests: true,
    size: WidgetSize.MEDIUM,
    refreshInterval: 60,
  };
}

describe('CloudTimelineProvider', () => {
  let store: ICloudStore;
  let syncManager: CloudSyncManager;
  let localDataSource: LocalDataSource;
  let provider: CloudTimelineProvider;

  beforeEach(() => {
    store = createMockStore();
    syncManager = new CloudSyncManager(store, 'test-device');
    localDataSource = createMockLocalDataSource();
    provider = new CloudTimelineProvider(syncManager, localDataSource);
  });

  describe('getTimeline', () => {
    it('returns 60 entries when iCloud data is fresh', async () => {
      const usageData = createUsageData();

      // Write data to make it available via readUsageData
      await syncManager.writeUsageData(usageData);
      const storedJson = (store.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue(storedJson);

      const config = createSmallConfig();
      const timeline = await provider.getTimeline(config);

      expect(timeline.entries).toHaveLength(60);

      // Verify entries are 1 minute apart
      for (let i = 1; i < timeline.entries.length; i++) {
        const diff = timeline.entries[i].date.getTime() - timeline.entries[i - 1].date.getTime();
        expect(diff).toBe(60 * 1000);
      }

      // Verify each entry has the correct usage data
      for (const entry of timeline.entries) {
        expect(entry.usageData.tokensUsed).toBe(usageData.tokensUsed);
        expect(entry.usageData.tokensLimit).toBe(usageData.tokensLimit);
        expect(entry.usageData.messagesUsed).toBe(usageData.messagesUsed);
        expect(entry.usageData.messagesLimit).toBe(usageData.messagesLimit);
        expect(entry.configuration).toEqual(config);
      }
    });

    it('returns empty entries when no data is available', async () => {
      const config = createSmallConfig();
      const timeline = await provider.getTimeline(config);

      expect(timeline.entries).toHaveLength(0);
      expect(timeline.policy.afterDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getUsageDataWithFallback', () => {
    it('uses iCloud data when fresh', async () => {
      const usageData = createUsageData();
      await syncManager.writeUsageData(usageData);
      const storedJson = (store.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue(storedJson);

      const result = await provider.getUsageDataWithFallback();

      expect(result).not.toBeNull();
      expect(result!.tokensUsed).toBe(usageData.tokensUsed);
      expect(localDataSource.readUsageData).not.toHaveBeenCalled();
    });

    it('uses local data when iCloud is stale', async () => {
      // Set up stale iCloud data (syncTimestamp > 15 min ago)
      const staleTimestamp = new Date(Date.now() - 16 * 60 * 1000);
      const staleSyncData = JSON.stringify({
        usageData: {
          tokensUsed: 1000,
          tokensLimit: 100000,
          messagesUsed: 10,
          messagesLimit: 500,
          resetTime: new Date('2026-04-12T00:00:00Z').toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        syncTimestamp: staleTimestamp.toISOString(),
        deviceId: 'test-device',
      });
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue(staleSyncData);

      const localData = createUsageData({ tokensUsed: 8000 });
      localDataSource = createMockLocalDataSource(localData);
      provider = new CloudTimelineProvider(syncManager, localDataSource);

      const result = await provider.getUsageDataWithFallback();

      expect(result).not.toBeNull();
      expect(result!.tokensUsed).toBe(8000);
      expect(localDataSource.readUsageData).toHaveBeenCalled();
    });

    it('falls back to local data when iCloud is unavailable', async () => {
      store = createMockStore({ isAvailable: vi.fn().mockReturnValue(false) });
      syncManager = new CloudSyncManager(store, 'test-device');

      const localData = createUsageData({ tokensUsed: 3000 });
      localDataSource = createMockLocalDataSource(localData);
      provider = new CloudTimelineProvider(syncManager, localDataSource);

      const result = await provider.getUsageDataWithFallback();

      expect(result).not.toBeNull();
      expect(result!.tokensUsed).toBe(3000);
    });

    it('returns stale iCloud data when local is also null', async () => {
      const staleTimestamp = new Date(Date.now() - 20 * 60 * 1000);
      const staleSyncData = JSON.stringify({
        usageData: {
          tokensUsed: 2000,
          tokensLimit: 100000,
          messagesUsed: 15,
          messagesLimit: 500,
          resetTime: new Date('2026-04-12T00:00:00Z').toISOString(),
          lastUpdated: new Date().toISOString(),
        },
        syncTimestamp: staleTimestamp.toISOString(),
        deviceId: 'test-device',
      });
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue(staleSyncData);

      const result = await provider.getUsageDataWithFallback();

      expect(result).not.toBeNull();
      expect(result!.tokensUsed).toBe(2000);
    });

    it('returns null when both iCloud and local have no data', async () => {
      const result = await provider.getUsageDataWithFallback();
      expect(result).toBeNull();
    });
  });

  describe('generateTimelineEntries', () => {
    it('creates proper entries for SMALL widget size', () => {
      const usageData = createUsageData();
      const config = createSmallConfig();

      const entries = provider.generateTimelineEntries(usageData, config);

      expect(entries).toHaveLength(60);
      expect(entries[0].configuration.size).toBe(WidgetSize.SMALL);

      for (const entry of entries) {
        expect(entry.usageData).toBe(usageData);
        expect(entry.configuration).toBe(config);
        expect(entry.date).toBeInstanceOf(Date);
      }
    });

    it('creates proper entries for MEDIUM widget size', () => {
      const usageData = createUsageData();
      const config = createMediumConfig();

      const entries = provider.generateTimelineEntries(usageData, config);

      expect(entries).toHaveLength(60);
      expect(entries[0].configuration.size).toBe(WidgetSize.MEDIUM);

      for (const entry of entries) {
        expect(entry.usageData).toBe(usageData);
        expect(entry.configuration).toBe(config);
        expect(entry.date).toBeInstanceOf(Date);
      }
    });

    it('creates entries 1 minute apart', () => {
      const usageData = createUsageData();
      const config = createSmallConfig();

      const entries = provider.generateTimelineEntries(usageData, config);

      for (let i = 1; i < entries.length; i++) {
        const diff = entries[i].date.getTime() - entries[i - 1].date.getTime();
        expect(diff).toBe(60 * 1000);
      }
    });
  });
});
