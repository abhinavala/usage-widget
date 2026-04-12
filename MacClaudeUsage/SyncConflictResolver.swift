import Foundation

/// Resolves conflicts when multiple devices update sync data simultaneously.
class SyncConflictResolver {

    /// The strategy used to resolve conflicts.
    enum Strategy {
        /// Choose the data with the most recent lastSyncTime.
        case mostRecent
        /// Choose the data with the higher syncVersion.
        case highestVersion
    }

    /// The active resolution strategy.
    let strategy: Strategy

    init(strategy: Strategy = .mostRecent) {
        self.strategy = strategy
    }

    /// Resolves a conflict between local and remote sync data dictionaries.
    /// Returns a merged dictionary with the winning data and an incremented syncVersion.
    /// - Parameters:
    ///   - local: The local sync data dictionary.
    ///   - remote: The remote sync data dictionary.
    /// - Returns: The resolved sync data dictionary.
    func resolve(local: [String: Any], remote: [String: Any]) -> [String: Any] {
        let localTime = local["lastSyncTime"] as? TimeInterval ?? 0
        let remoteTime = remote["lastSyncTime"] as? TimeInterval ?? 0
        let localVersion = local["syncVersion"] as? Int ?? 0
        let remoteVersion = remote["syncVersion"] as? Int ?? 0

        var winner: [String: Any]

        switch strategy {
        case .mostRecent:
            winner = remoteTime >= localTime ? remote : local
        case .highestVersion:
            winner = remoteVersion >= localVersion ? remote : local
        }

        // Increment syncVersion to mark the resolution
        let maxVersion = max(localVersion, remoteVersion)
        var resolved = winner
        resolved["syncVersion"] = maxVersion + 1
        resolved["lastSyncTime"] = Date().timeIntervalSince1970

        NSLog("[SyncConflictResolver] Resolved conflict: strategy=\(strategy), localVersion=\(localVersion), remoteVersion=\(remoteVersion), resolvedVersion=\(maxVersion + 1)")

        return resolved
    }
}
