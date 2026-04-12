import Foundation
import Combine

/// Manages app settings and configuration, persisting values to UserDefaults.
/// Publishes changes via Combine so SwiftUI views reactively update.
class SettingsManager: ObservableObject {

    // MARK: - UserDefaults Keys

    private enum Keys {
        static let overrideExpirationMinutes = "settings.overrideExpirationMinutes"
        static let widgetRefreshIntervalMinutes = "settings.widgetRefreshIntervalMinutes"
        static let dataSourcePriority = "settings.dataSourcePriority"
        static let showResetTime = "settings.showResetTime"
        static let colorTheme = "settings.colorTheme"
        static let lastSyncTimestamp = "settings.lastSyncTimestamp"
        static let syncStatus = "settings.syncStatus"
    }

    // MARK: - Defaults

    static let defaultOverrideExpirationMinutes: Int = 1440 // 24 hours
    static let defaultWidgetRefreshIntervalMinutes: Int = 15
    static let defaultDataSourcePriority: String = "webapi"
    static let defaultShowResetTime: Bool = true
    static let defaultColorTheme: String = "auto"

    // MARK: - Published Properties

    @Published var overrideExpirationMinutes: Int {
        didSet { defaults.set(overrideExpirationMinutes, forKey: Keys.overrideExpirationMinutes) }
    }

    @Published var widgetRefreshIntervalMinutes: Int {
        didSet { defaults.set(widgetRefreshIntervalMinutes, forKey: Keys.widgetRefreshIntervalMinutes) }
    }

    @Published var dataSourcePriority: String {
        didSet { defaults.set(dataSourcePriority, forKey: Keys.dataSourcePriority) }
    }

    @Published var showResetTime: Bool {
        didSet { defaults.set(showResetTime, forKey: Keys.showResetTime) }
    }

    @Published var colorTheme: String {
        didSet { defaults.set(colorTheme, forKey: Keys.colorTheme) }
    }

    @Published var lastSyncTimestamp: Date?

    @Published var syncStatus: SyncStatusValue = .offline

    // MARK: - Sync Status Enum

    enum SyncStatusValue: String, Codable, Equatable {
        case synced
        case syncing
        case error
        case offline
    }

    // MARK: - Private

    private let defaults: UserDefaults

    // MARK: - Init

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        // Load persisted values or use defaults
        self.overrideExpirationMinutes = defaults.object(forKey: Keys.overrideExpirationMinutes) as? Int
            ?? SettingsManager.defaultOverrideExpirationMinutes

        self.widgetRefreshIntervalMinutes = defaults.object(forKey: Keys.widgetRefreshIntervalMinutes) as? Int
            ?? SettingsManager.defaultWidgetRefreshIntervalMinutes

        self.dataSourcePriority = defaults.string(forKey: Keys.dataSourcePriority)
            ?? SettingsManager.defaultDataSourcePriority

        self.showResetTime = defaults.object(forKey: Keys.showResetTime) as? Bool
            ?? SettingsManager.defaultShowResetTime

        self.colorTheme = defaults.string(forKey: Keys.colorTheme)
            ?? SettingsManager.defaultColorTheme

        if let timestamp = defaults.object(forKey: Keys.lastSyncTimestamp) as? Date {
            self.lastSyncTimestamp = timestamp
        }

        if let statusRaw = defaults.string(forKey: Keys.syncStatus),
           let status = SyncStatusValue(rawValue: statusRaw) {
            self.syncStatus = status
        }
    }

    // MARK: - Sync Actions

    /// Triggers a manual iCloud sync operation.
    /// Updates syncStatus to .syncing, then calls the completion handler.
    func triggerManualSync(completion: @escaping (Result<Void, Error>) -> Void) {
        syncStatus = .syncing

        NSUbiquitousKeyValueStore.default.synchronize()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self else { return }
            self.lastSyncTimestamp = Date()
            self.defaults.set(self.lastSyncTimestamp, forKey: Keys.lastSyncTimestamp)
            self.syncStatus = .synced
            self.defaults.set(self.syncStatus.rawValue, forKey: Keys.syncStatus)
            completion(.success(()))
        }
    }

    /// Updates the sync status and persists it.
    func updateSyncStatus(_ status: SyncStatusValue) {
        syncStatus = status
        defaults.set(status.rawValue, forKey: Keys.syncStatus)
    }

    /// Records a successful sync timestamp.
    func recordSyncTimestamp(_ date: Date = Date()) {
        lastSyncTimestamp = date
        defaults.set(date, forKey: Keys.lastSyncTimestamp)
    }

    // MARK: - Data Management

    /// Clears all override data by resetting override-related settings to defaults.
    func clearAllOverrideData() {
        overrideExpirationMinutes = SettingsManager.defaultOverrideExpirationMinutes
        defaults.set(overrideExpirationMinutes, forKey: Keys.overrideExpirationMinutes)
    }

    /// Resets all settings to their default values.
    func resetToDefaults() {
        overrideExpirationMinutes = SettingsManager.defaultOverrideExpirationMinutes
        widgetRefreshIntervalMinutes = SettingsManager.defaultWidgetRefreshIntervalMinutes
        dataSourcePriority = SettingsManager.defaultDataSourcePriority
        showResetTime = SettingsManager.defaultShowResetTime
        colorTheme = SettingsManager.defaultColorTheme
    }

    /// Returns the override expiration as a TimeInterval in seconds.
    var overrideExpirationInterval: TimeInterval {
        return TimeInterval(overrideExpirationMinutes * 60)
    }
}
