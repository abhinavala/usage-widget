import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudSyncManager, ICloudStore } from '../../services/CloudSyncManager';
import { SyncStatusEnum, SyncError, UsageData } from '../../types/sync';

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

describe('CloudSyncManager', () => {
  let manager: CloudSyncManager;
  let store: ICloudStore;

  beforeEach(() => {
    store = createMockStore();
    manager = new CloudSyncManager(store, 'test-device-id');
  });

  describe('writeUsageData', () => {
    it('successfully stores valid usage data to iCloud', async () => {
      const data = createUsageData();

      const status = await manager.writeUsageData(data);

      expect(status).toBe(SyncStatusEnum.SUCCESS);
      expect(store.set).toHaveBeenCalledWith(
        'com.claudeusage.syncData',
        expect.any(String)
      );
      expect(store.synchronize).toHaveBeenCalled();

      // Verify the stored data can be read back
      const storedJson = (store.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue(storedJson);

      const result = await manager.readUsageData();
      expect(result).not.toBeNull();
      expect(result!.usageData.tokensUsed).toBe(data.tokensUsed);
      expect(result!.usageData.tokensLimit).toBe(data.tokensLimit);
      expect(result!.usageData.messagesUsed).toBe(data.messagesUsed);
      expect(result!.usageData.messagesLimit).toBe(data.messagesLimit);
      expect(result!.deviceId).toBe('test-device-id');
      expect(result!.syncTimestamp).toBeInstanceOf(Date);
    });

    it('throws SyncError when iCloud is not available', async () => {
      store = createMockStore({ isAvailable: vi.fn().mockReturnValue(false) });
      manager = new CloudSyncManager(store, 'test-device-id');

      await expect(manager.writeUsageData(createUsageData())).rejects.toThrow(SyncError);
      await expect(manager.writeUsageData(createUsageData())).rejects.toMatchObject({
        code: 'ICLOUD_UNAVAILABLE',
        operation: 'write',
        recoverable: true,
      });
    });

    it('throws SyncError when store write fails', async () => {
      store = createMockStore({ set: vi.fn().mockReturnValue(false) });
      manager = new CloudSyncManager(store, 'test-device-id');

      await expect(manager.writeUsageData(createUsageData())).rejects.toThrow(SyncError);
    });

    it('updates sync state on successful write', async () => {
      await manager.writeUsageData(createUsageData());

      const state = manager.getSyncState();
      expect(state.isStale).toBe(false);
      expect(state.syncError).toBeUndefined();
      expect(state.lastSyncTime.getTime()).toBeGreaterThan(0);
    });
  });

  describe('readUsageData', () => {
    it('returns null when no data exists in iCloud', async () => {
      const result = await manager.readUsageData();

      expect(result).toBeNull();
      const state = manager.getSyncState();
      expect(state.syncError).toBeUndefined();
    });

    it('throws SyncError when iCloud is not available', async () => {
      store = createMockStore({ isAvailable: vi.fn().mockReturnValue(false) });
      manager = new CloudSyncManager(store, 'test-device-id');

      await expect(manager.readUsageData()).rejects.toThrow(SyncError);
    });

    it('deserializes stored data correctly', async () => {
      const data = createUsageData();
      await manager.writeUsageData(data);

      const storedJson = (store.set as ReturnType<typeof vi.fn>).mock.calls[0][1];
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue(storedJson);

      const result = await manager.readUsageData();
      expect(result).not.toBeNull();
      expect(result!.usageData.resetTime).toBeInstanceOf(Date);
      expect(result!.usageData.lastUpdated).toBeInstanceOf(Date);
      expect(result!.syncTimestamp).toBeInstanceOf(Date);
    });

    it('throws SyncError on corrupted data', async () => {
      (store.get as ReturnType<typeof vi.fn>).mockReturnValue('invalid json{{{');

      await expect(manager.readUsageData()).rejects.toThrow(SyncError);
      await expect(manager.readUsageData()).rejects.toMatchObject({
        code: 'DESERIALIZE_FAILED',
        recoverable: false,
      });
    });
  });

  describe('isDataStale', () => {
    it('returns true for timestamps older than 15 minutes', () => {
      const oldTimestamp = new Date(Date.now() - 16 * 60 * 1000);
      expect(manager.isDataStale(oldTimestamp)).toBe(true);
    });

    it('returns false for recent timestamps', () => {
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000);
      expect(manager.isDataStale(recentTimestamp)).toBe(false);
    });

    it('returns false for timestamps exactly at 15 minutes', () => {
      const exactThreshold = new Date(Date.now() - 15 * 60 * 1000);
      expect(manager.isDataStale(exactThreshold)).toBe(false);
    });

    it('returns true for timestamps just over 15 minutes', () => {
      const justOver = new Date(Date.now() - 15 * 60 * 1000 - 1);
      expect(manager.isDataStale(justOver)).toBe(true);
    });
  });

  describe('getSyncState', () => {
    it('returns initial stale state before any operations', () => {
      const state = manager.getSyncState();
      expect(state.isStale).toBe(true);
      expect(state.lastSyncTime.getTime()).toBe(0);
      expect(state.syncError).toBeUndefined();
    });

    it('returns a copy of the state (not a reference)', () => {
      const state1 = manager.getSyncState();
      const state2 = manager.getSyncState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('reflects error state after failed operation', async () => {
      store = createMockStore({ isAvailable: vi.fn().mockReturnValue(false) });
      manager = new CloudSyncManager(store, 'test-device-id');

      try {
        await manager.writeUsageData(createUsageData());
      } catch {
        // expected
      }

      const state = manager.getSyncState();
      expect(state.syncError).toBe('iCloud is not available');
    });
  });
});
