import Foundation

enum SyncStatus: String, Codable {
    case synced = "synced"
    case syncing = "syncing"
    case error = "error"
    case offline = "offline"
}

enum SyncError: Error, Codable {
    case ICLOUD_UNAVAILABLE
    case QUOTA_EXCEEDED
    case SYNC_CONFLICT
    case NETWORK_ERROR

    var localizedDescription: String {
        switch self {
        case .ICLOUD_UNAVAILABLE:
            return "iCloud is not available. Please sign in to iCloud in Settings."
        case .QUOTA_EXCEEDED:
            return "iCloud storage quota exceeded."
        case .SYNC_CONFLICT:
            return "A sync conflict was detected. The most recent change has been kept."
        case .NETWORK_ERROR:
            return "Network error. Changes will be synced when connectivity is restored."
        }
    }
}

struct SyncData: Codable {
    var usage: UsageData?
    var manualOverride: ManualOverride?
    var lastSync: Date

    init(usage: UsageData? = nil, manualOverride: ManualOverride? = nil, lastSync: Date = Date()) {
        self.usage = usage
        self.manualOverride = manualOverride
        self.lastSync = lastSync
    }
}
