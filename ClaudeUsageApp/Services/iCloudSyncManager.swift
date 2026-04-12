import Foundation
import Combine

class iCloudSyncManager: ObservableObject {

    // MARK: - Published Properties

    @Published var syncStatus: SyncStatus = .offline
    @Published var syncData: SyncData = SyncData()
    @Published var lastError: SyncError?

    // MARK: - Private Properties

    private let store: NSUbiquitousKeyValueStore
    private var cancellables = Set<AnyCancellable>()
    private var pendingOverride: ManualOverride?

    // MARK: - iCloud Keys

    private enum Keys {
        static let usageData = "com.claudeusage.usageData"
        static let manualOverride = "com.claudeusage.manualOverride"
        static let lastSync = "com.claudeusage.lastSync"
    }

    // MARK: - Initialization

    init(store: NSUbiquitousKeyValueStore = .default) {
        self.store = store
        observeRemoteChanges()
        loadFromStore()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Public Methods

    func syncManualOverride(_ override: ManualOverride) throws {
        guard isICloudAvailable() else {
            pendingOverride = override
            syncStatus = .error
            lastError = .ICLOUD_UNAVAILABLE
            throw SyncError.ICLOUD_UNAVAILABLE
        }

        syncStatus = .syncing

        do {
            let data = try JSONEncoder().encode(override)
            store.set(data, forKey: Keys.manualOverride)
            store.set(Date().timeIntervalSince1970, forKey: Keys.lastSync)

            let synchronized = store.synchronize()
            if !synchronized {
                syncStatus = .error
                lastError = .QUOTA_EXCEEDED
                throw SyncError.QUOTA_EXCEEDED
            }

            syncData.manualOverride = override
            syncData.lastSync = Date()
            syncStatus = .synced
            lastError = nil
            pendingOverride = nil
        } catch let error as SyncError {
            throw error
        } catch {
            syncStatus = .error
            lastError = .NETWORK_ERROR
            throw SyncError.NETWORK_ERROR
        }
    }

    func syncUsageData(_ usage: UsageData) throws {
        guard isICloudAvailable() else {
            syncStatus = .error
            lastError = .ICLOUD_UNAVAILABLE
            throw SyncError.ICLOUD_UNAVAILABLE
        }

        syncStatus = .syncing

        do {
            let data = try JSONEncoder().encode(usage)
            store.set(data, forKey: Keys.usageData)
            store.set(Date().timeIntervalSince1970, forKey: Keys.lastSync)

            let synchronized = store.synchronize()
            if !synchronized {
                syncStatus = .error
                lastError = .QUOTA_EXCEEDED
                throw SyncError.QUOTA_EXCEEDED
            }

            syncData.usage = usage
            syncData.lastSync = Date()
            syncStatus = .synced
            lastError = nil
        } catch let error as SyncError {
            throw error
        } catch {
            syncStatus = .error
            lastError = .NETWORK_ERROR
            throw SyncError.NETWORK_ERROR
        }
    }

    func resolveConflict(local: SyncData, remote: SyncData) -> SyncData {
        if remote.lastSync > local.lastSync {
            return remote
        }
        return local
    }

    func retryPendingChanges() {
        guard let pending = pendingOverride else { return }
        do {
            try syncManualOverride(pending)
        } catch {
            // Retry will be attempted again later
        }
    }

    func forceSync() {
        loadFromStore()
        store.synchronize()
    }

    // MARK: - Remote Change Observation

    func observeRemoteChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRemoteChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
    }

    @objc private func handleRemoteChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let changeReason = userInfo[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int else {
            return
        }

        switch changeReason {
        case NSUbiquitousKeyValueStoreServerChange,
             NSUbiquitousKeyValueStoreInitialSyncChange:
            loadFromStore()

        case NSUbiquitousKeyValueStoreQuotaViolationChange:
            syncStatus = .error
            lastError = .QUOTA_EXCEEDED

        case NSUbiquitousKeyValueStoreAccountChange:
            syncStatus = .offline
            syncData = SyncData()

        default:
            loadFromStore()
        }
    }

    // MARK: - Private Methods

    private func isICloudAvailable() -> Bool {
        return FileManager.default.ubiquityIdentityToken != nil
    }

    private func loadFromStore() {
        let decoder = JSONDecoder()

        if let usageBytes = store.data(forKey: Keys.usageData) {
            syncData.usage = try? decoder.decode(UsageData.self, from: usageBytes)
        }

        if let overrideBytes = store.data(forKey: Keys.manualOverride) {
            syncData.manualOverride = try? decoder.decode(ManualOverride.self, from: overrideBytes)
        }

        let lastSyncTimestamp = store.double(forKey: Keys.lastSync)
        if lastSyncTimestamp > 0 {
            syncData.lastSync = Date(timeIntervalSince1970: lastSyncTimestamp)
        }

        if isICloudAvailable() {
            syncStatus = .synced
            lastError = nil
        } else {
            syncStatus = .offline
        }
    }
}
