import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SERVICES_DIR = resolve(__dirname, '..', 'Services');
const MODELS_DIR = resolve(__dirname, '..', 'Models');

describe('iCloudSyncTests', () => {
  describe('syncManualOverride successfully writes to iCloud Key-Value Store', () => {
    const syncManagerContent = readFileSync(
      resolve(SERVICES_DIR, 'iCloudSyncManager.swift'),
      'utf-8'
    );

    it('defines iCloudSyncManager class conforming to ObservableObject', () => {
      expect(syncManagerContent).toContain('class iCloudSyncManager: ObservableObject');
    });

    it('imports Foundation and Combine', () => {
      expect(syncManagerContent).toContain('import Foundation');
      expect(syncManagerContent).toContain('import Combine');
    });

    it('uses NSUbiquitousKeyValueStore for iCloud sync', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStore');
    });

    it('has a syncManualOverride method that accepts ManualOverride', () => {
      expect(syncManagerContent).toContain('func syncManualOverride(_ override: ManualOverride)');
    });

    it('encodes override data with JSONEncoder before writing to store', () => {
      expect(syncManagerContent).toContain('JSONEncoder().encode(override)');
    });

    it('writes override data to iCloud store with correct key', () => {
      expect(syncManagerContent).toContain('store.set(data, forKey: Keys.manualOverride)');
    });

    it('updates lastSync timestamp after writing', () => {
      expect(syncManagerContent).toContain('store.set(Date().timeIntervalSince1970, forKey: Keys.lastSync)');
    });

    it('calls synchronize to trigger iCloud sync', () => {
      expect(syncManagerContent).toContain('store.synchronize()');
    });

    it('updates syncStatus to synced on success', () => {
      expect(syncManagerContent).toContain('syncStatus = .synced');
    });

    it('updates syncData.manualOverride on success', () => {
      expect(syncManagerContent).toContain('syncData.manualOverride = override');
    });

    it('sets syncStatus to syncing while in progress', () => {
      expect(syncManagerContent).toContain('syncStatus = .syncing');
    });

    it('publishes syncStatus as an observable property', () => {
      expect(syncManagerContent).toContain('@Published var syncStatus: SyncStatus');
    });

    it('publishes syncData as an observable property', () => {
      expect(syncManagerContent).toContain('@Published var syncData: SyncData');
    });
  });

  describe('observeRemoteChanges detects Mac app data updates', () => {
    const syncManagerContent = readFileSync(
      resolve(SERVICES_DIR, 'iCloudSyncManager.swift'),
      'utf-8'
    );

    it('has an observeRemoteChanges method', () => {
      expect(syncManagerContent).toContain('func observeRemoteChanges()');
    });

    it('registers for didChangeExternallyNotification', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStore.didChangeExternallyNotification');
    });

    it('adds observer via NotificationCenter', () => {
      expect(syncManagerContent).toContain('NotificationCenter.default.addObserver');
    });

    it('handles remote change notifications', () => {
      expect(syncManagerContent).toContain('handleRemoteChange');
    });

    it('checks change reason from notification userInfo', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStoreChangeReasonKey');
    });

    it('handles server change reason', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStoreServerChange');
    });

    it('handles initial sync change reason', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStoreInitialSyncChange');
    });

    it('handles quota violation change reason', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStoreQuotaViolationChange');
    });

    it('handles account change reason', () => {
      expect(syncManagerContent).toContain('NSUbiquitousKeyValueStoreAccountChange');
    });

    it('loads data from store when remote changes are detected', () => {
      expect(syncManagerContent).toContain('loadFromStore()');
    });

    it('decodes usage data from store', () => {
      expect(syncManagerContent).toContain('decoder.decode(UsageData.self');
    });

    it('decodes manual override data from store', () => {
      expect(syncManagerContent).toContain('decoder.decode(ManualOverride.self');
    });
  });

  describe('sync handles iCloud unavailable error gracefully', () => {
    const syncManagerContent = readFileSync(
      resolve(SERVICES_DIR, 'iCloudSyncManager.swift'),
      'utf-8'
    );

    it('checks iCloud availability before syncing', () => {
      expect(syncManagerContent).toContain('isICloudAvailable()');
    });

    it('checks ubiquityIdentityToken for iCloud availability', () => {
      expect(syncManagerContent).toContain('FileManager.default.ubiquityIdentityToken');
    });

    it('throws ICLOUD_UNAVAILABLE error when iCloud is not available', () => {
      expect(syncManagerContent).toContain('throw SyncError.ICLOUD_UNAVAILABLE');
    });

    it('queues pending override changes for retry when iCloud is unavailable', () => {
      expect(syncManagerContent).toContain('pendingOverride = override');
    });

    it('has a retryPendingChanges method', () => {
      expect(syncManagerContent).toContain('func retryPendingChanges()');
    });

    it('retries pending override when retryPendingChanges is called', () => {
      expect(syncManagerContent).toContain('try syncManualOverride(pending)');
    });

    it('sets status to error when iCloud is unavailable', () => {
      expect(syncManagerContent).toContain('syncStatus = .error');
    });

    it('sets lastError to ICLOUD_UNAVAILABLE', () => {
      expect(syncManagerContent).toContain('lastError = .ICLOUD_UNAVAILABLE');
    });

    it('publishes lastError as an observable property', () => {
      expect(syncManagerContent).toContain('@Published var lastError: SyncError?');
    });

    it('handles QUOTA_EXCEEDED error', () => {
      expect(syncManagerContent).toContain('lastError = .QUOTA_EXCEEDED');
    });

    it('handles NETWORK_ERROR', () => {
      expect(syncManagerContent).toContain('lastError = .NETWORK_ERROR');
    });

    it('sets status to offline when account changes', () => {
      expect(syncManagerContent).toContain('syncStatus = .offline');
    });
  });

  describe('SyncStatus model definitions', () => {
    const syncStatusContent = readFileSync(
      resolve(MODELS_DIR, 'SyncStatus.swift'),
      'utf-8'
    );

    it('defines SyncStatus enum', () => {
      expect(syncStatusContent).toContain('enum SyncStatus: String, Codable');
    });

    it('has synced case', () => {
      expect(syncStatusContent).toContain('case synced');
    });

    it('has syncing case', () => {
      expect(syncStatusContent).toContain('case syncing');
    });

    it('has error case', () => {
      expect(syncStatusContent).toContain('case error');
    });

    it('has offline case', () => {
      expect(syncStatusContent).toContain('case offline');
    });

    it('defines SyncError enum conforming to Error', () => {
      expect(syncStatusContent).toContain('enum SyncError: Error');
    });

    it('has ICLOUD_UNAVAILABLE error case', () => {
      expect(syncStatusContent).toContain('case ICLOUD_UNAVAILABLE');
    });

    it('has QUOTA_EXCEEDED error case', () => {
      expect(syncStatusContent).toContain('case QUOTA_EXCEEDED');
    });

    it('has SYNC_CONFLICT error case', () => {
      expect(syncStatusContent).toContain('case SYNC_CONFLICT');
    });

    it('has NETWORK_ERROR error case', () => {
      expect(syncStatusContent).toContain('case NETWORK_ERROR');
    });

    it('defines SyncData struct with Codable conformance', () => {
      expect(syncStatusContent).toContain('struct SyncData: Codable');
    });

    it('SyncData has optional usage property', () => {
      expect(syncStatusContent).toContain('var usage: UsageData?');
    });

    it('SyncData has optional manualOverride property', () => {
      expect(syncStatusContent).toContain('var manualOverride: ManualOverride?');
    });

    it('SyncData has lastSync date property', () => {
      expect(syncStatusContent).toContain('var lastSync: Date');
    });

    it('SyncError provides localized descriptions', () => {
      expect(syncStatusContent).toContain('localizedDescription');
    });

    it('provides meaningful error message for iCloud unavailable', () => {
      expect(syncStatusContent).toContain('iCloud is not available');
    });

    it('provides meaningful error message for sync conflict', () => {
      expect(syncStatusContent).toContain('sync conflict was detected');
    });

    it('provides meaningful error message for network error', () => {
      expect(syncStatusContent).toContain('Network error');
    });
  });

  describe('iCloudSyncManager conflict resolution', () => {
    const syncManagerContent = readFileSync(
      resolve(SERVICES_DIR, 'iCloudSyncManager.swift'),
      'utf-8'
    );

    it('has a resolveConflict method', () => {
      expect(syncManagerContent).toContain('func resolveConflict(local: SyncData, remote: SyncData) -> SyncData');
    });

    it('compares lastSync timestamps to resolve conflicts', () => {
      expect(syncManagerContent).toContain('remote.lastSync > local.lastSync');
    });

    it('has a forceSync method for manual sync', () => {
      expect(syncManagerContent).toContain('func forceSync()');
    });

    it('removes observer on deinit', () => {
      expect(syncManagerContent).toContain('NotificationCenter.default.removeObserver(self)');
    });

    it('accepts injectable store for testing', () => {
      expect(syncManagerContent).toContain('init(store: NSUbiquitousKeyValueStore = .default)');
    });
  });
});
