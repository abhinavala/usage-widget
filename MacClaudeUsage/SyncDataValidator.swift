import Foundation

/// Validates sync data integrity before reading or writing to iCloud.
class SyncDataValidator {

    /// Keys required in a valid sync data dictionary.
    static let requiredKeys = ["tokensUsed", "requestCount", "lastActiveTime", "syncVersion", "lastSyncTime"]

    /// Validates a SyncData dictionary for correctness and integrity.
    /// - Parameter data: The dictionary representation of SyncData.
    /// - Returns: `true` if the data is valid, `false` otherwise.
    static func validate(_ data: [String: Any]) -> Bool {
        // Check all required keys are present
        for key in requiredKeys {
            guard data[key] != nil else {
                NSLog("[SyncDataValidator] Missing required key: \(key)")
                return false
            }
        }

        // Validate tokensUsed is a non-negative number
        guard let tokensUsed = data["tokensUsed"] as? Int, tokensUsed >= 0 else {
            NSLog("[SyncDataValidator] Invalid tokensUsed: must be a non-negative integer")
            return false
        }

        // Validate requestCount is a non-negative number
        guard let requestCount = data["requestCount"] as? Int, requestCount >= 0 else {
            NSLog("[SyncDataValidator] Invalid requestCount: must be a non-negative integer")
            return false
        }

        // Validate lastActiveTime is a valid timestamp
        guard let lastActiveTime = data["lastActiveTime"] as? TimeInterval, lastActiveTime > 0 else {
            NSLog("[SyncDataValidator] Invalid lastActiveTime: must be a positive timestamp")
            return false
        }

        // Validate syncVersion is a positive integer
        guard let syncVersion = data["syncVersion"] as? Int, syncVersion > 0 else {
            NSLog("[SyncDataValidator] Invalid syncVersion: must be a positive integer")
            return false
        }

        // Validate lastSyncTime is a valid timestamp
        guard let lastSyncTime = data["lastSyncTime"] as? TimeInterval, lastSyncTime > 0 else {
            NSLog("[SyncDataValidator] Invalid lastSyncTime: must be a positive timestamp")
            return false
        }

        // Validate checksum if present
        if let checksum = data["checksum"] as? String {
            let computedChecksum = computeChecksum(
                tokensUsed: tokensUsed,
                requestCount: requestCount,
                syncVersion: syncVersion
            )
            guard checksum == computedChecksum else {
                NSLog("[SyncDataValidator] Checksum mismatch: expected \(computedChecksum), got \(checksum)")
                return false
            }
        }

        return true
    }

    /// Computes a simple checksum for data integrity verification.
    static func computeChecksum(tokensUsed: Int, requestCount: Int, syncVersion: Int) -> String {
        let combined = "\(tokensUsed):\(requestCount):\(syncVersion)"
        var hash: UInt64 = 5381
        for byte in combined.utf8 {
            hash = ((hash << 5) &+ hash) &+ UInt64(byte)
        }
        return String(hash, radix: 16)
    }
}
