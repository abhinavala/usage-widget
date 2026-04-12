import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MacFetchService, UsageFetcher, FetchResult } from '../../services/MacFetchService';
import { CloudSyncManager, ICloudStore } from '../../services/CloudSyncManager';
import { UsageData, SyncStatus, SyncError } from '../../types/sync';

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

function createMockFetcher(
  data: UsageData = createUsageData(),
  type: 'webapi' | 'cli' = 'webapi'
): UsageFetcher {
  return {
    fetch: vi.fn().mockResolvedValue(data),
    type,
  };
}

describe('MacFetchService', () => {
  let service: MacFetchService;
  let fetcher: UsageFetcher;
  let syncManager: CloudSyncManager;
  let store: ICloudStore;

  beforeEach(() => {
    vi.restoreAllMocks();
    store = createMockStore();
    syncManager = new CloudSyncManager(store, 'test-device-id');
    fetcher = createMockFetcher();
    service = new MacFetchService(fetcher, syncManager);
  });

  describe('fetchAndSync', () => {
    it('successfully fetches data and syncs to iCloud', async () => {
      const result = await service.fetchAndSync();

      expect(result.success).toBe(true);
      expect(result.data.tokensUsed).toBe(5000);
      expect(result.source).toBe('webapi');
      expect(result.error).toBeUndefined();
      expect(store.set).toHaveBeenCalledTimes(1);
    });

    it('returns failure result when fetcher throws', async () => {
      fetcher = {
        fetch: vi.fn().mockRejectedValue(new Error('Network error')),
        type: 'webapi',
      };
      service = new MacFetchService(fetcher, syncManager);

      const result = await service.fetchAndSync();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.source).toBe('webapi');
      expect(store.set).not.toHaveBeenCalled();
    });

    it('works with CLI fetcher type', async () => {
      fetcher = createMockFetcher(createUsageData(), 'cli');
      service = new MacFetchService(fetcher, syncManager);

      const result = await service.fetchAndSync();

      expect(result.success).toBe(true);
      expect(result.source).toBe('cli');
    });
  });

  describe('handleFetchSuccess', () => {
    it('continues when iCloud sync fails', async () => {
      store = createMockStore({ isAvailable: vi.fn().mockReturnValue(false) });
      syncManager = new CloudSyncManager(store, 'test-device-id');
      service = new MacFetchService(fetcher, syncManager);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        service.handleFetchSuccess(createUsageData())
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('iCloud sync failed')
      );
    });

    it('logs success when iCloud sync succeeds', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.handleFetchSuccess(createUsageData());

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('iCloud sync succeeded')
      );
    });

    it('does not throw even when sync manager throws non-recoverable error', async () => {
      vi.spyOn(syncManager, 'writeUsageData').mockRejectedValue(
        new SyncError('Corrupt', 'CORRUPT', 'write', false)
      );
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        service.handleFetchSuccess(createUsageData())
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('retrySyncWithBackoff', () => {
    it('returns SUCCESS on first successful attempt', async () => {
      const status = await service.retrySyncWithBackoff(createUsageData());

      expect(status).toBe(SyncStatus.SUCCESS);
      expect(store.set).toHaveBeenCalledTimes(1);
    });

    it('attempts sync 3 times before giving up', async () => {
      const writeSpy = vi
        .spyOn(syncManager, 'writeUsageData')
        .mockRejectedValue(
          new SyncError('Unavailable', 'ICLOUD_UNAVAILABLE', 'write', true)
        );

      // Mock sleep to avoid actual delays
      vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await expect(
        service.retrySyncWithBackoff(createUsageData())
      ).rejects.toThrow(SyncError);

      expect(writeSpy).toHaveBeenCalledTimes(3);
    });

    it('succeeds on second attempt after first failure', async () => {
      const writeSpy = vi
        .spyOn(syncManager, 'writeUsageData')
        .mockRejectedValueOnce(
          new SyncError('Temporary', 'WRITE_FAILED', 'write', true)
        )
        .mockResolvedValueOnce(SyncStatus.SUCCESS);

      vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      const status = await service.retrySyncWithBackoff(createUsageData());

      expect(status).toBe(SyncStatus.SUCCESS);
      expect(writeSpy).toHaveBeenCalledTimes(2);
    });

    it('throws immediately for non-recoverable errors without retrying', async () => {
      const writeSpy = vi
        .spyOn(syncManager, 'writeUsageData')
        .mockRejectedValue(
          new SyncError('Corrupt data', 'DESERIALIZE_FAILED', 'write', false)
        );

      vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

      await expect(
        service.retrySyncWithBackoff(createUsageData())
      ).rejects.toThrow(SyncError);

      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('uses exponential backoff between retries', async () => {
      vi.spyOn(syncManager, 'writeUsageData').mockRejectedValue(
        new SyncError('Unavailable', 'ICLOUD_UNAVAILABLE', 'write', true)
      );

      const sleepSpy = vi
        .spyOn(service as any, 'sleep')
        .mockResolvedValue(undefined);

      await expect(
        service.retrySyncWithBackoff(createUsageData())
      ).rejects.toThrow();

      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
    });
  });

  describe('getConfig', () => {
    it('returns default LaunchAgent config', () => {
      const config = service.getConfig();

      expect(config.keepAlive).toBe(true);
      expect(config.fetchInterval).toBe(5 * 60 * 1000);
      expect(config.isUIElement).toBe(true);
    });

    it('returns a copy of the config', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
