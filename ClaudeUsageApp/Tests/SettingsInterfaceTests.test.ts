import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const APP_DIR = resolve(__dirname, '..');

describe('SettingsInterfaceTests', () => {
  describe('SettingsManager saves override expiration preference correctly', () => {
    const managerContent = readFileSync(
      resolve(APP_DIR, 'Services/SettingsManager.swift'),
      'utf-8'
    );

    it('defines SettingsManager class as ObservableObject', () => {
      expect(managerContent).toContain('class SettingsManager: ObservableObject');
    });

    it('imports Foundation and Combine', () => {
      expect(managerContent).toContain('import Foundation');
      expect(managerContent).toContain('import Combine');
    });

    it('has overrideExpirationMinutes as Published property', () => {
      expect(managerContent).toContain('@Published var overrideExpirationMinutes: Int');
    });

    it('persists expiration value to UserDefaults on change', () => {
      expect(managerContent).toContain('didSet { defaults.set(overrideExpirationMinutes, forKey: Keys.overrideExpirationMinutes) }');
    });

    it('defines a UserDefaults key for override expiration', () => {
      expect(managerContent).toContain('static let overrideExpirationMinutes = "settings.overrideExpirationMinutes"');
    });

    it('provides a default expiration value of 24 hours (1440 minutes)', () => {
      expect(managerContent).toContain('static let defaultOverrideExpirationMinutes: Int = 1440');
    });

    it('loads persisted expiration value on init or falls back to default', () => {
      expect(managerContent).toContain('defaults.object(forKey: Keys.overrideExpirationMinutes) as? Int');
      expect(managerContent).toContain('SettingsManager.defaultOverrideExpirationMinutes');
    });

    it('accepts custom UserDefaults for testability', () => {
      expect(managerContent).toContain('init(defaults: UserDefaults = .standard)');
    });

    it('persists widget refresh interval to UserDefaults', () => {
      expect(managerContent).toContain('@Published var widgetRefreshIntervalMinutes: Int');
      expect(managerContent).toContain('didSet { defaults.set(widgetRefreshIntervalMinutes, forKey: Keys.widgetRefreshIntervalMinutes) }');
    });

    it('persists data source priority to UserDefaults', () => {
      expect(managerContent).toContain('@Published var dataSourcePriority: String');
    });

    it('persists color theme setting to UserDefaults', () => {
      expect(managerContent).toContain('@Published var colorTheme: String');
    });

    it('persists showResetTime setting to UserDefaults', () => {
      expect(managerContent).toContain('@Published var showResetTime: Bool');
    });

    it('provides resetToDefaults method', () => {
      expect(managerContent).toContain('func resetToDefaults()');
    });

    it('provides clearAllOverrideData method', () => {
      expect(managerContent).toContain('func clearAllOverrideData()');
    });

    it('computes overrideExpirationInterval in seconds', () => {
      expect(managerContent).toContain('var overrideExpirationInterval: TimeInterval');
    });
  });

  describe('SyncStatusView displays current sync status accurately', () => {
    const syncViewContent = readFileSync(
      resolve(APP_DIR, 'Views/Components/SyncStatusView.swift'),
      'utf-8'
    );

    it('defines SyncStatusView struct conforming to View', () => {
      expect(syncViewContent).toContain('struct SyncStatusView: View');
    });

    it('imports SwiftUI', () => {
      expect(syncViewContent).toContain('import SwiftUI');
    });

    it('observes SettingsManager for sync status changes', () => {
      expect(syncViewContent).toContain('@ObservedObject var settingsManager: SettingsManager');
    });

    it('displays status text matching SyncStatus enum values', () => {
      expect(syncViewContent).toContain('case .synced');
      expect(syncViewContent).toContain('case .syncing');
      expect(syncViewContent).toContain('case .error');
      expect(syncViewContent).toContain('case .offline');
    });

    it('shows status text for synced state', () => {
      expect(syncViewContent).toContain('return "Synced"');
    });

    it('shows status text for syncing state', () => {
      expect(syncViewContent).toContain('return "Syncing…"');
    });

    it('shows status text for error state', () => {
      expect(syncViewContent).toContain('return "Sync Error"');
    });

    it('shows status text for offline state', () => {
      expect(syncViewContent).toContain('return "Offline"');
    });

    it('displays last sync timestamp when available', () => {
      expect(syncViewContent).toContain('lastSyncTimestamp');
      expect(syncViewContent).toContain('Last synced:');
    });

    it('uses appropriate SF Symbols for each status', () => {
      expect(syncViewContent).toContain('checkmark.icloud.fill');
      expect(syncViewContent).toContain('arrow.triangle.2.circlepath.icloud.fill');
      expect(syncViewContent).toContain('exclamationmark.icloud.fill');
      expect(syncViewContent).toContain('icloud.slash.fill');
    });

    it('uses color coding for status states', () => {
      expect(syncViewContent).toContain('return .green');
      expect(syncViewContent).toContain('return .blue');
      expect(syncViewContent).toContain('return .red');
      expect(syncViewContent).toContain('return .gray');
    });

    it('provides error-state retry button', () => {
      expect(syncViewContent).toContain('Retry Sync');
      expect(syncViewContent).toContain('triggerManualSync');
    });

    it('includes accessibility labels', () => {
      expect(syncViewContent).toContain('accessibilityLabel');
      expect(syncViewContent).toContain('Sync status:');
    });

    it('includes a preview provider', () => {
      expect(syncViewContent).toContain('#Preview');
    });

    it('provides descriptive help text for each status', () => {
      expect(syncViewContent).toContain('All data is up to date with iCloud.');
      expect(syncViewContent).toContain('Syncing data with iCloud');
      expect(syncViewContent).toContain('Unable to sync');
      expect(syncViewContent).toContain('No network connection');
    });
  });

  describe('manual sync trigger initiates iCloud sync operation', () => {
    const managerContent = readFileSync(
      resolve(APP_DIR, 'Services/SettingsManager.swift'),
      'utf-8'
    );

    it('defines SyncStatusValue enum with required cases', () => {
      expect(managerContent).toContain('enum SyncStatusValue: String, Codable, Equatable');
      expect(managerContent).toContain('case synced');
      expect(managerContent).toContain('case syncing');
      expect(managerContent).toContain('case error');
      expect(managerContent).toContain('case offline');
    });

    it('has a Published syncStatus property', () => {
      expect(managerContent).toContain('@Published var syncStatus: SyncStatusValue');
    });

    it('provides triggerManualSync method with completion handler', () => {
      expect(managerContent).toContain('func triggerManualSync(completion: @escaping (Result<Void, Error>) -> Void)');
    });

    it('sets status to syncing when sync is triggered', () => {
      expect(managerContent).toContain('syncStatus = .syncing');
    });

    it('calls NSUbiquitousKeyValueStore synchronize for iCloud sync', () => {
      expect(managerContent).toContain('NSUbiquitousKeyValueStore.default.synchronize()');
    });

    it('updates status to synced on successful completion', () => {
      expect(managerContent).toContain('self.syncStatus = .synced');
    });

    it('records lastSyncTimestamp on successful sync', () => {
      expect(managerContent).toContain('self.lastSyncTimestamp = Date()');
    });

    it('has a Published lastSyncTimestamp property', () => {
      expect(managerContent).toContain('@Published var lastSyncTimestamp: Date?');
    });

    it('provides updateSyncStatus method', () => {
      expect(managerContent).toContain('func updateSyncStatus(_ status: SyncStatusValue)');
    });

    it('persists sync status to UserDefaults', () => {
      expect(managerContent).toContain('defaults.set(status.rawValue, forKey: Keys.syncStatus)');
    });

    it('provides recordSyncTimestamp method', () => {
      expect(managerContent).toContain('func recordSyncTimestamp(_ date: Date = Date())');
    });
  });

  describe('SettingsView interface organization', () => {
    const settingsContent = readFileSync(
      resolve(APP_DIR, 'Views/SettingsView.swift'),
      'utf-8'
    );

    it('defines SettingsView struct conforming to View', () => {
      expect(settingsContent).toContain('struct SettingsView: View');
    });

    it('imports SwiftUI', () => {
      expect(settingsContent).toContain('import SwiftUI');
    });

    it('uses StateObject for SettingsManager', () => {
      expect(settingsContent).toContain('@StateObject private var settingsManager = SettingsManager()');
    });

    it('organizes settings into logical sections', () => {
      expect(settingsContent).toContain('syncStatusSection');
      expect(settingsContent).toContain('overrideBehaviorSection');
      expect(settingsContent).toContain('widgetAppearanceSection');
      expect(settingsContent).toContain('dataPreferencesSection');
      expect(settingsContent).toContain('troubleshootingSection');
    });

    it('includes section headers with clear labels', () => {
      expect(settingsContent).toContain('"Sync Status"');
      expect(settingsContent).toContain('"Override Behavior"');
      expect(settingsContent).toContain('"Widget Appearance"');
      expect(settingsContent).toContain('"Data Preferences"');
      expect(settingsContent).toContain('"Troubleshooting"');
    });

    it('includes section footers with help text', () => {
      expect(settingsContent).toContain('Shows the current sync status');
      expect(settingsContent).toContain('Controls how long manual override');
      expect(settingsContent).toContain('These preferences sync across');
    });

    it('includes SyncStatusView in sync section', () => {
      expect(settingsContent).toContain('SyncStatusView(settingsManager: settingsManager)');
    });

    it('has override expiration picker', () => {
      expect(settingsContent).toContain('"Override Expiration"');
      expect(settingsContent).toContain('overrideExpirationMinutes');
    });

    it('has color theme picker', () => {
      expect(settingsContent).toContain('"Color Theme"');
      expect(settingsContent).toContain('colorTheme');
    });

    it('has show reset time toggle', () => {
      expect(settingsContent).toContain('"Show Reset Time"');
      expect(settingsContent).toContain('showResetTime');
    });

    it('has data source priority picker', () => {
      expect(settingsContent).toContain('"Data Source Priority"');
      expect(settingsContent).toContain('dataSourcePriority');
    });

    it('provides manual sync trigger button', () => {
      expect(settingsContent).toContain('"Sync Now"');
      expect(settingsContent).toContain('triggerManualSync');
    });

    it('provides clear override data button', () => {
      expect(settingsContent).toContain('"Clear All Override Data"');
      expect(settingsContent).toContain('showClearOverrideConfirmation');
    });

    it('provides reset all settings button', () => {
      expect(settingsContent).toContain('"Reset All Settings"');
      expect(settingsContent).toContain('showResetConfirmation');
    });

    it('has confirmation dialogs for destructive actions', () => {
      expect(settingsContent).toContain('alert("Reset All Settings"');
      expect(settingsContent).toContain('alert("Clear Override Data"');
      expect(settingsContent).toContain('role: .destructive');
    });

    it('uses List layout for settings', () => {
      expect(settingsContent).toContain('List {');
    });

    it('sets navigation title', () => {
      expect(settingsContent).toContain('.navigationTitle("Settings")');
    });

    it('includes accessibility labels', () => {
      expect(settingsContent).toContain('.accessibilityLabel');
      expect(settingsContent).toContain('.accessibilityHint');
    });

    it('includes a preview provider', () => {
      expect(settingsContent).toContain('#Preview');
    });
  });
});
