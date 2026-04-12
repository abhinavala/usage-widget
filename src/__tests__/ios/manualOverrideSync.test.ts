import { describe, it, expect, beforeEach } from 'vitest';
import { ManualOverrideService, ManualOverride, isOverrideExpired } from '../../ios/ManualOverrideService';
import { CloudSyncManager, ICloudStore } from '../../services/CloudSyncManager';
import { SyncStatusEnum, UsageData } from '../../types/sync';

function createMockStore(available = true): ICloudStore {
  const storage = new Map<string, string>();
  return {
    get: (key: string) => storage.get(key) ?? null,
    set: (key: string, value: string) => {
      storage.set(key, value);
      return true;
    },
    synchronize: () => true,
    isAvailable: () => available,
  };
}

function createTestUsageData(overrides: Partial<UsageData> = {}): UsageData {
  return {
    tokensUsed: 5000,
    tokensLimit: 100000,
    messagesUsed: 50,
    messagesLimit: 1000,
    resetTime: new Date('2026-04-12T00:00:00Z'),
    lastUpdated: new Date('2026-04-11T12:00:00Z'),
    ...overrides,
  };
}

function createTestOverride(overrides: Partial<ManualOverride> = {}): ManualOverride {
  return {
    tokensUsed: 8000,
    tokensLimit: 100000,
    requestsUsed: 80,
    requestsLimit: 1000,
    isActive: true,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    ...overrides,
  };
}

describe('ManualOverrideService', () => {
  let store: ICloudStore;
  let syncManager: CloudSyncManager;
  let service: ManualOverrideService;

  beforeEach(() => {
    store = createMockStore();
    syncManager = new CloudSyncManager(store, 'test-device-ios');
    service = new ManualOverrideService(syncManager);
  });

  describe('saveManualOverride', () => {
    it('successfully syncs override data to iCloud', async () => {
      const usageData = createTestUsageData();
      await syncManager.writeUsageData(usageData);

      const override = createTestOverride();
      const status = await service.saveManualOverride(override);

      expect(status).toBe(SyncStatusEnum.SUCCESS);

      const appState = await service.loadAppState();
      expect(appState.manualOverride).toBeDefined();
      expect(appState.manualOverride!.isActive).toBe(true);
      expect(appState.manualOverride!.expiresAt).toEqual(override.expiresAt);
      expect(appState.usageData.tokensUsed).toBe(override.tokensUsed);
      expect(appState.usageData.messagesUsed).toBe(override.requestsUsed);
    });

    it('throws when saving an expired override', async () => {
      const expiredOverride = createTestOverride({
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.saveManualOverride(expiredOverride)).rejects.toThrow(
        'Cannot save an expired override'
      );
    });
  });

  describe('resolveConflict', () => {
    it('correctly handles user choice to keep override', async () => {
      const usageData = createTestUsageData();
      await syncManager.writeUsageData(usageData);

      const override = createTestOverride({
        tokensUsed: 15000,
        requestsUsed: 150,
      });
      await service.saveManualOverride(override);

      const appState = await service.resolveConflict(true);

      expect(appState.manualOverride).toBeDefined();
      expect(appState.manualOverride!.isActive).toBe(true);
      expect(appState.manualOverride!.tokensUsed).toBe(15000);
      expect(appState.manualOverride!.requestsUsed).toBe(150);
      expect(appState.usageData.tokensUsed).toBe(15000);
      expect(appState.usageData.messagesUsed).toBe(150);
    });

    it('correctly handles user choice to accept fetched data', async () => {
      const usageData = createTestUsageData({ tokensUsed: 3000 });
      await syncManager.writeUsageData(usageData);

      const override = createTestOverride({ tokensUsed: 15000 });
      await service.saveManualOverride(override);

      const appState = await service.resolveConflict(false);

      expect(appState.manualOverride).toBeUndefined();
    });
  });

  describe('isOverrideExpired', () => {
    it('correctly identifies expired overrides', () => {
      const expiredOverride = createTestOverride({
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(isOverrideExpired(expiredOverride)).toBe(true);
    });

    it('correctly identifies non-expired overrides', () => {
      const activeOverride = createTestOverride({
        expiresAt: new Date(Date.now() + 60000),
      });
      expect(isOverrideExpired(activeOverride)).toBe(false);
    });
  });

  describe('loadAppState', () => {
    it('returns default state when no cloud data exists', async () => {
      const appState = await service.loadAppState();

      expect(appState.usageData).toBeDefined();
      expect(appState.syncState).toBeDefined();
      expect(appState.manualOverride).toBeUndefined();
    });

    it('clears expired overrides on load', async () => {
      const override = createTestOverride({
        expiresAt: new Date(Date.now() + 100),
      });
      await service.saveManualOverride(override);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const appState = await service.loadAppState();
      expect(appState.manualOverride).toBeUndefined();
    });
  });

  describe('hasConflict', () => {
    it('returns false when no override is active', () => {
      expect(service.hasConflict()).toBe(false);
    });

    it('returns false when override is expired', async () => {
      const override = createTestOverride({
        expiresAt: new Date(Date.now() + 50),
      });
      await service.saveManualOverride(override);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(service.hasConflict()).toBe(false);
    });
  });

  describe('createOverride', () => {
    it('creates override with correct expiration', () => {
      const before = Date.now();
      const override = service.createOverride({
        tokensUsed: 5000,
        tokensLimit: 100000,
      }, 3600000);
      const after = Date.now();

      expect(override.isActive).toBe(true);
      expect(override.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600000);
      expect(override.expiresAt.getTime()).toBeLessThanOrEqual(after + 3600000);
      expect(override.tokensUsed).toBe(5000);
    });
  });
});
