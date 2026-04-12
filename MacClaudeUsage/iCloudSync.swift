import Foundation

/// Represents the result of a sync operation.
struct SyncResult {
    let success: Bool
    let operation: SyncOperation
    let timestamp: Date
    let error: String?
}

/// The type of sync operation performed.
enum SyncOperation: String {
    case read
    case write
    case delete
}

/// Callback type for sync data change notifications.
typealias SyncChangeHandler = ([String: Any]) -> Void

/// Manages iCloud Key-Value Store synchronization for cross-device data sharing.
/// Wraps NSUbiquitousKeyValueStore with error handling, validation, conflict resolution,
/// and rate limiting.
class ICloudSyncManager {

    /// Shared singleton instance.
    static let shared = ICloudSyncManager()

    /// The iCloud Key-Value Store key used for usage data.
    static let syncDataKey = "com.claudeusage.syncData"

    /// Maximum number of sync writes per minute to avoid exceeding iCloud KV store quotas.
    static let maxWritesPerMinute = 12

    /// The underlying iCloud key-value store.
    private let store: NSUbiquitousKeyValueStore

    /// Conflict resolver for handling simultaneous updates.
    private let conflictResolver: SyncConflictResolver

    /// Registered change handlers.
    private var changeHandlers: [SyncChangeHandler] = []

    /// Timestamps of recent write operations for rate limiting.
    private var recentWriteTimestamps: [Date] = []

    /// Local cache for offline access.
    private var localCache: [String: Any]?

    init(store: NSUbiquitousKeyValueStore = .default, conflictResolver: SyncConflictResolver = SyncConflictResolver()) {
        self.store = store
        self.conflictResolver = conflictResolver
        setupNotificationObserver()
        loadLocalCache()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Public API

    /// Syncs usage data to iCloud Key-Value Store.
    /// - Parameter data: A dictionary representing the usage data to sync.
    /// - Returns: A `SyncResult` indicating success or failure.
    func syncUsageData(_ data: [String: Any]) -> SyncResult {
        // Validate data before writing
        guard SyncDataValidator.validate(data) else {
            return SyncResult(
                success: false,
                operation: .write,
                timestamp: Date(),
                error: "Data validation failed"
            )
        }

        // Check rate limiting
        guard isWithinRateLimit() else {
            return SyncResult(
                success: false,
                operation: .write,
                timestamp: Date(),
                error: "Rate limit exceeded: max \(ICloudSyncManager.maxWritesPerMinute) writes per minute"
            )
        }

        // Check for conflicts with existing remote data
        var dataToWrite = data
        if let existingData = store.dictionary(forKey: ICloudSyncManager.syncDataKey) {
            let localVersion = data["syncVersion"] as? Int ?? 0
            let remoteVersion = existingData["syncVersion"] as? Int ?? 0
            if remoteVersion > localVersion {
                dataToWrite = conflictResolver.resolve(local: data, remote: existingData)
            }
        }

        // Add checksum for integrity
        if let tokensUsed = dataToWrite["tokensUsed"] as? Int,
           let requestCount = dataToWrite["requestCount"] as? Int,
           let syncVersion = dataToWrite["syncVersion"] as? Int {
            var mutableData = dataToWrite
            mutableData["checksum"] = SyncDataValidator.computeChecksum(
                tokensUsed: tokensUsed,
                requestCount: requestCount,
                syncVersion: syncVersion
            )
            dataToWrite = mutableData
        }

        // Write to iCloud KV store
        store.set(dataToWrite, forKey: ICloudSyncManager.syncDataKey)
        let synced = store.synchronize()

        // Update local cache
        localCache = dataToWrite
        saveLocalCache()

        // Record write timestamp for rate limiting
        recentWriteTimestamps.append(Date())

        NSLog("[ICloudSyncManager] Sync write completed: success=\(synced)")

        return SyncResult(
            success: synced,
            operation: .write,
            timestamp: Date(),
            error: synced ? nil : "iCloud synchronize returned false"
        )
    }

    /// Reads the current sync data from iCloud Key-Value Store.
    /// Falls back to local cache if iCloud data is unavailable.
    /// - Returns: A tuple of the data (if available) and a `SyncResult`.
    func readSyncData() -> (data: [String: Any]?, result: SyncResult) {
        // Try reading from iCloud
        if let data = store.dictionary(forKey: ICloudSyncManager.syncDataKey) {
            // Validate before returning
            if SyncDataValidator.validate(data) {
                localCache = data
                saveLocalCache()
                return (data, SyncResult(success: true, operation: .read, timestamp: Date(), error: nil))
            } else {
                NSLog("[ICloudSyncManager] Remote data failed validation, falling back to cache")
            }
        }

        // Fall back to local cache
        if let cached = localCache {
            return (cached, SyncResult(success: true, operation: .read, timestamp: Date(), error: "Using cached data"))
        }

        return (nil, SyncResult(success: false, operation: .read, timestamp: Date(), error: "No sync data available"))
    }

    /// Deletes sync data from iCloud Key-Value Store.
    /// - Returns: A `SyncResult` indicating success or failure.
    func deleteSyncData() -> SyncResult {
        store.removeObject(forKey: ICloudSyncManager.syncDataKey)
        let synced = store.synchronize()
        localCache = nil
        saveLocalCache()

        NSLog("[ICloudSyncManager] Sync delete completed: success=\(synced)")

        return SyncResult(
            success: synced,
            operation: .delete,
            timestamp: Date(),
            error: synced ? nil : "iCloud synchronize returned false"
        )
    }

    /// Reads synced data from iCloud Key-Value Store.
    /// Alias for `readSyncData()` matching the integration contract.
    /// Falls back to local cache if iCloud data is unavailable.
    /// - Returns: A tuple of the data (if available) and a `SyncResult`.
    func readSyncedData() -> (data: [String: Any]?, result: SyncResult) {
        return readSyncData()
    }

    /// Resolves a sync conflict between local and remote data.
    /// Delegates to the `SyncConflictResolver`.
    /// - Parameters:
    ///   - local: The local sync data dictionary.
    ///   - remote: The remote sync data dictionary.
    /// - Returns: The resolved sync data dictionary.
    func resolveSyncConflict(local: [String: Any], remote: [String: Any]) -> [String: Any] {
        return conflictResolver.resolve(local: local, remote: remote)
    }

    /// Validates sync data for correctness and integrity.
    /// Delegates to `SyncDataValidator`.
    /// - Parameter data: The dictionary representation of SyncData.
    /// - Returns: `true` if the data is valid, `false` otherwise.
    func validateSyncData(_ data: [String: Any]) -> Bool {
        return SyncDataValidator.validate(data)
    }

    /// Registers a callback to be notified when remote sync data changes.
    /// - Parameter handler: A closure that receives the updated data dictionary.
    func registerSyncCallback(_ handler: @escaping SyncChangeHandler) {
        changeHandlers.append(handler)
    }

    /// Registers a handler to be called when remote sync data changes.
    /// - Parameter handler: A closure that receives the updated data dictionary.
    func onSyncChange(_ handler: @escaping SyncChangeHandler) {
        changeHandlers.append(handler)
    }

    // MARK: - Rate Limiting

    /// Checks whether a write operation is within the rate limit.
    private func isWithinRateLimit() -> Bool {
        let oneMinuteAgo = Date().addingTimeInterval(-60)
        recentWriteTimestamps = recentWriteTimestamps.filter { $0 > oneMinuteAgo }
        return recentWriteTimestamps.count < ICloudSyncManager.maxWritesPerMinute
    }

    // MARK: - Notification Handling

    /// Sets up observer for iCloud KV store external change notifications.
    private func setupNotificationObserver() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleStoreChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
    }

    /// Handles external iCloud KV store changes (from other devices).
    @objc private func handleStoreChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reason = userInfo[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int else {
            return
        }

        NSLog("[ICloudSyncManager] External change received: reason=\(reason)")

        switch reason {
        case NSUbiquitousKeyValueStoreServerChange,
             NSUbiquitousKeyValueStoreInitialSyncChange:
            if let data = store.dictionary(forKey: ICloudSyncManager.syncDataKey) {
                if SyncDataValidator.validate(data) {
                    // Check for conflict with local cache
                    if let cached = localCache {
                        let localVersion = cached["syncVersion"] as? Int ?? 0
                        let remoteVersion = data["syncVersion"] as? Int ?? 0
                        if localVersion > remoteVersion {
                            let resolved = conflictResolver.resolve(local: cached, remote: data)
                            localCache = resolved
                            notifyChangeHandlers(resolved)
                            return
                        }
                    }
                    localCache = data
                    saveLocalCache()
                    notifyChangeHandlers(data)
                } else {
                    NSLog("[ICloudSyncManager] Received invalid data from remote, ignoring")
                }
            }

        case NSUbiquitousKeyValueStoreQuotaViolationChange:
            NSLog("[ICloudSyncManager] iCloud KV store quota exceeded")

        case NSUbiquitousKeyValueStoreAccountChange:
            NSLog("[ICloudSyncManager] iCloud account changed, clearing local cache")
            localCache = nil
            saveLocalCache()

        default:
            break
        }
    }

    /// Notifies all registered change handlers.
    private func notifyChangeHandlers(_ data: [String: Any]) {
        for handler in changeHandlers {
            handler(data)
        }
    }

    // MARK: - Local Cache

    /// The file URL for the local cache.
    private var cacheFileURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("com.claudeusage.syncCache.plist")
    }

    /// Loads the local cache from disk.
    private func loadLocalCache() {
        guard let url = cacheFileURL,
              let data = try? Data(contentsOf: url),
              let dict = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else {
            return
        }
        localCache = dict
    }

    /// Saves the local cache to disk.
    private func saveLocalCache() {
        guard let url = cacheFileURL else { return }
        if let cache = localCache {
            if let data = try? PropertyListSerialization.data(fromPropertyList: cache, format: .binary, options: 0) {
                try? data.write(to: url)
            }
        } else {
            try? FileManager.default.removeItem(at: url)
        }
    }
}
