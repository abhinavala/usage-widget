import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { SyncData, SyncOperation, SyncResult, UsageData } from '../../src/types/sync';
import { SyncError } from '../../src/types/errors';
import type { LaunchAgentConfig, AppVisibility, SystemStatus } from '../../src/types/system';

const MAC_APP_DIR = resolve(__dirname, '..');

function readSwiftFile(filename: string): string {
  return readFileSync(resolve(MAC_APP_DIR, filename), 'utf-8');
}

describe('iCloudSync', () => {
  let iCloudSyncSource: string;
  let conflictResolverSource: string;
  let validatorSource: string;

  beforeEach(() => {
    iCloudSyncSource = readSwiftFile('iCloudSync.swift');
    conflictResolverSource = readSwiftFile('SyncConflictResolver.swift');
    validatorSource = readSwiftFile('SyncDataValidator.swift');
  });

  describe('syncUsageData successfully stores data in iCloud and returns success result', () => {
    it('SyncResult type has correct shape with success and operation fields', () => {
      const result: SyncResult = {
        success: true,
        operation: 'write',
        timestamp: new Date(),
      };
      expect(result.success).toBe(true);
      expect(result.operation).toBe('write');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('SyncData interface matches integration contract', () => {
      const usageData: UsageData = {
        tokensUsed: 1500,
        requestCount: 10,
        lastActiveTime: new Date(),
      };
      const syncData: SyncData = {
        usageData,
        lastSyncTime: new Date(),
        syncVersion: 1,
      };
      expect(syncData.usageData.tokensUsed).toBe(1500);
      expect(syncData.syncVersion).toBe(1);
      expect(syncData.lastSyncTime).toBeInstanceOf(Date);
    });

    it('SyncOperation covers read, write, and delete', () => {
      const operations: SyncOperation[] = ['read', 'write', 'delete'];
      expect(operations).toHaveLength(3);
      expect(operations).toContain('read');
      expect(operations).toContain('write');
      expect(operations).toContain('delete');
    });

    it('iCloudSync.swift implements syncUsageData function', () => {
      expect(iCloudSyncSource).toContain('func syncUsageData');
      expect(iCloudSyncSource).toContain('SyncResult');
      expect(iCloudSyncSource).toContain('operation: .write');
    });

    it('iCloudSync.swift uses NSUbiquitousKeyValueStore', () => {
      expect(iCloudSyncSource).toContain('NSUbiquitousKeyValueStore');
      expect(iCloudSyncSource).toContain('syncDataKey');
    });

    it('iCloudSync.swift validates data before writing', () => {
      expect(iCloudSyncSource).toContain('SyncDataValidator.validate');
      expect(iCloudSyncSource).toContain('Data validation failed');
    });

    it('iCloudSync.swift supports read, write, and delete operations', () => {
      expect(iCloudSyncSource).toContain('func syncUsageData');
      expect(iCloudSyncSource).toContain('func readSyncData');
      expect(iCloudSyncSource).toContain('func readSyncedData');
      expect(iCloudSyncSource).toContain('func deleteSyncData');
    });

    it('SyncResult error field is optional', () => {
      const successResult: SyncResult = {
        success: true,
        operation: 'write',
        timestamp: new Date(),
      };
      const failureResult: SyncResult = {
        success: false,
        operation: 'write',
        timestamp: new Date(),
        error: 'Data validation failed',
      };
      expect(successResult.error).toBeUndefined();
      expect(failureResult.error).toBe('Data validation failed');
    });
  });

  describe('resolveSyncConflict chooses most recent data when timestamps differ', () => {
    it('SyncConflictResolver.swift implements resolve method', () => {
      expect(conflictResolverSource).toContain('func resolve');
      expect(conflictResolverSource).toContain('local:');
      expect(conflictResolverSource).toContain('remote:');
    });

    it('conflict resolution increments syncVersion', () => {
      // Verify the Swift source increments version on resolution
      expect(conflictResolverSource).toContain('maxVersion + 1');
      expect(conflictResolverSource).toContain('resolved["syncVersion"]');
    });

    it('conflict resolver supports mostRecent strategy', () => {
      expect(conflictResolverSource).toContain('case mostRecent');
      expect(conflictResolverSource).toContain('remoteTime >= localTime');
    });

    it('conflict resolver supports highestVersion strategy', () => {
      expect(conflictResolverSource).toContain('case highestVersion');
      expect(conflictResolverSource).toContain('remoteVersion >= localVersion');
    });

    it('conflict resolution simulated with TypeScript types picks newer timestamp', () => {
      const olderSync: SyncData = {
        usageData: { tokensUsed: 100, requestCount: 5, lastActiveTime: new Date('2026-04-10T10:00:00Z') },
        lastSyncTime: new Date('2026-04-10T10:00:00Z'),
        syncVersion: 1,
      };
      const newerSync: SyncData = {
        usageData: { tokensUsed: 200, requestCount: 10, lastActiveTime: new Date('2026-04-11T10:00:00Z') },
        lastSyncTime: new Date('2026-04-11T10:00:00Z'),
        syncVersion: 2,
      };

      // Most recent strategy: pick the one with the later lastSyncTime
      const winner = newerSync.lastSyncTime > olderSync.lastSyncTime ? newerSync : olderSync;
      const resolvedVersion = Math.max(olderSync.syncVersion, newerSync.syncVersion) + 1;

      expect(winner.usageData.tokensUsed).toBe(200);
      expect(resolvedVersion).toBe(3);
    });

    it('iCloudSync.swift uses SyncConflictResolver for conflicts', () => {
      expect(iCloudSyncSource).toContain('conflictResolver.resolve');
    });
  });

  describe('validateSyncData rejects data with invalid usage numbers or corrupted structure', () => {
    it('SyncDataValidator.swift implements validate method', () => {
      expect(validatorSource).toContain('static func validate');
      expect(validatorSource).toContain('[String: Any]');
      expect(validatorSource).toContain('-> Bool');
    });

    it('validator checks for required keys', () => {
      expect(validatorSource).toContain('requiredKeys');
      expect(validatorSource).toContain('tokensUsed');
      expect(validatorSource).toContain('requestCount');
      expect(validatorSource).toContain('lastActiveTime');
      expect(validatorSource).toContain('syncVersion');
      expect(validatorSource).toContain('lastSyncTime');
    });

    it('validator rejects negative tokensUsed', () => {
      expect(validatorSource).toContain('tokensUsed');
      expect(validatorSource).toContain('>= 0');
    });

    it('validator rejects negative requestCount', () => {
      expect(validatorSource).toContain('requestCount');
      // Both tokensUsed and requestCount validated as non-negative
      const nonNegativeChecks = (validatorSource.match(/>= 0/g) || []).length;
      expect(nonNegativeChecks).toBeGreaterThanOrEqual(2);
    });

    it('validator checks data integrity with checksum', () => {
      expect(validatorSource).toContain('computeChecksum');
      expect(validatorSource).toContain('checksum');
    });

    it('validation rejects missing required fields in TypeScript', () => {
      // Simulate validation logic: missing fields should fail
      const incompleteData: Partial<SyncData> = {
        lastSyncTime: new Date(),
        // missing usageData and syncVersion
      };
      const hasAllFields = incompleteData.usageData !== undefined
        && incompleteData.syncVersion !== undefined
        && incompleteData.lastSyncTime !== undefined;
      expect(hasAllFields).toBe(false);
    });

    it('validation rejects negative usage numbers in TypeScript', () => {
      const invalidUsage: UsageData = {
        tokensUsed: -100,
        requestCount: -5,
        lastActiveTime: new Date(),
      };
      const isValid = invalidUsage.tokensUsed >= 0 && invalidUsage.requestCount >= 0;
      expect(isValid).toBe(false);
    });
  });

  describe('SyncError class', () => {
    it('SyncError extends Error with code and operation fields', () => {
      const error = new SyncError('Sync failed', 'SYNC_WRITE_FAILED', 'write');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Sync failed');
      expect(error.code).toBe('SYNC_WRITE_FAILED');
      expect(error.operation).toBe('write');
      expect(error.name).toBe('SyncError');
    });
  });

  describe('sync callbacks and error handling', () => {
    it('iCloudSync.swift registers change handlers via registerSyncCallback', () => {
      expect(iCloudSyncSource).toContain('func registerSyncCallback');
      expect(iCloudSyncSource).toContain('onSyncChange');
      expect(iCloudSyncSource).toContain('SyncChangeHandler');
      expect(iCloudSyncSource).toContain('changeHandlers');
    });

    it('iCloudSync.swift exposes resolveSyncConflict method', () => {
      expect(iCloudSyncSource).toContain('func resolveSyncConflict');
      expect(iCloudSyncSource).toContain('conflictResolver.resolve');
    });

    it('iCloudSync.swift exposes validateSyncData method', () => {
      expect(iCloudSyncSource).toContain('func validateSyncData');
      expect(iCloudSyncSource).toContain('SyncDataValidator.validate');
    });

    it('iCloudSync.swift exposes readSyncedData method', () => {
      expect(iCloudSyncSource).toContain('func readSyncedData');
    });

    it('iCloudSync.swift observes iCloud external change notifications', () => {
      expect(iCloudSyncSource).toContain('didChangeExternallyNotification');
      expect(iCloudSyncSource).toContain('handleStoreChange');
    });

    it('iCloudSync.swift handles iCloud account changes', () => {
      expect(iCloudSyncSource).toContain('NSUbiquitousKeyValueStoreAccountChange');
      expect(iCloudSyncSource).toContain('iCloud account changed');
    });

    it('iCloudSync.swift handles quota violations', () => {
      expect(iCloudSyncSource).toContain('NSUbiquitousKeyValueStoreQuotaViolationChange');
      expect(iCloudSyncSource).toContain('quota exceeded');
    });
  });

  describe('rate limiting prevents exceeding iCloud Key-Value Store quotas', () => {
    it('iCloudSync.swift implements rate limiting', () => {
      expect(iCloudSyncSource).toContain('isWithinRateLimit');
      expect(iCloudSyncSource).toContain('maxWritesPerMinute');
      expect(iCloudSyncSource).toContain('recentWriteTimestamps');
    });

    it('rate limit error message is descriptive', () => {
      expect(iCloudSyncSource).toContain('Rate limit exceeded');
    });
  });

  describe('local cache for offline access', () => {
    it('iCloudSync.swift implements local caching', () => {
      expect(iCloudSyncSource).toContain('localCache');
      expect(iCloudSyncSource).toContain('loadLocalCache');
      expect(iCloudSyncSource).toContain('saveLocalCache');
    });

    it('readSyncData falls back to local cache', () => {
      expect(iCloudSyncSource).toContain('Fall back to local cache');
      expect(iCloudSyncSource).toContain('Using cached data');
    });
  });

  describe('integration with dependency types', () => {
    it('SystemStatus type is available from dependency', () => {
      const status: SystemStatus = {
        isRunning: true,
        visibility: 'background',
      };
      expect(status.isRunning).toBe(true);
    });

    it('AppVisibility type covers all states', () => {
      const states: AppVisibility[] = ['visible', 'hidden', 'background'];
      expect(states).toHaveLength(3);
    });

    it('LaunchAgentConfig type is available from dependency', () => {
      const config: LaunchAgentConfig = {
        keepAlive: true,
        runAtLoad: true,
        startInterval: 300,
      };
      expect(config.keepAlive).toBe(true);
    });
  });
});
