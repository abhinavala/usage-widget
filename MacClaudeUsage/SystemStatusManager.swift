import Foundation

/// Describes the visibility state of the app.
enum AppVisibility: String {
    case visible
    case hidden
    case background
}

/// Represents the current system status of the Mac companion app.
struct SystemStatus {
    var isRunning: Bool
    var lastFetchTime: Date?
    var nextFetchTime: Date?
    var visibility: AppVisibility
}

/// Singleton manager that tracks and reports the app's system status.
class SystemStatusManager {
    static let shared = SystemStatusManager()

    private var status: SystemStatus

    private init() {
        self.status = SystemStatus(
            isRunning: false,
            lastFetchTime: nil,
            nextFetchTime: nil,
            visibility: .hidden
        )
    }

    /// Returns the current system status.
    func getSystemStatus() -> SystemStatus {
        return status
    }

    /// Updates the visibility state.
    func updateVisibility(_ visibility: AppVisibility) {
        status.visibility = visibility
    }

    /// Marks the app as running or stopped.
    func markRunning(_ running: Bool) {
        status.isRunning = running
    }

    /// Records the last fetch time and schedules the next fetch.
    func recordFetch(at date: Date = Date(), nextFetchIn interval: TimeInterval = 60) {
        status.lastFetchTime = date
        status.nextFetchTime = date.addingTimeInterval(interval)
    }
}
