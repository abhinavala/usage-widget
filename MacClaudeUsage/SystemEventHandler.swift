import Foundation
import AppKit

/// Handles system-level events (sleep, wake, network changes) that affect fetch scheduling.
/// Monitors NSWorkspace notifications and triggers appropriate scheduler responses.
class SystemEventHandler {
    static let shared = SystemEventHandler()

    private var onWake: (() -> Void)?
    private var onSleep: (() -> Void)?
    private var onNetworkChange: ((Bool) -> Void)?
    private var isMonitoring: Bool = false
    private(set) var lastWakeTime: Date?
    private(set) var lastSleepTime: Date?

    /// Stale data threshold in seconds. If the system was asleep longer than this,
    /// an immediate fetch is recommended on wake.
    static let staleThreshold: TimeInterval = 900

    init() {}

    /// Starts monitoring system events (sleep, wake, screen lock/unlock).
    /// - Parameters:
    ///   - onWake: Called when the system wakes from sleep.
    ///   - onSleep: Called when the system is going to sleep.
    ///   - onNetworkChange: Called when network reachability changes (true = available).
    func startMonitoring(
        onWake: @escaping () -> Void,
        onSleep: @escaping () -> Void,
        onNetworkChange: ((Bool) -> Void)? = nil
    ) {
        guard !isMonitoring else {
            NSLog("[MacClaudeUsage] SystemEventHandler: Already monitoring, ignoring duplicate start")
            return
        }

        self.onWake = onWake
        self.onSleep = onSleep
        self.onNetworkChange = onNetworkChange
        isMonitoring = true

        let center = NSWorkspace.shared.notificationCenter

        center.addObserver(
            self,
            selector: #selector(handleWake(_:)),
            name: NSWorkspace.didWakeNotification,
            object: nil
        )

        center.addObserver(
            self,
            selector: #selector(handleSleep(_:)),
            name: NSWorkspace.willSleepNotification,
            object: nil
        )

        center.addObserver(
            self,
            selector: #selector(handleScreenWake(_:)),
            name: NSWorkspace.screensDidWakeNotification,
            object: nil
        )

        NSLog("[MacClaudeUsage] SystemEventHandler: Started monitoring system events")
    }

    /// Stops monitoring system events and cleans up observers.
    func stopMonitoring() {
        guard isMonitoring else { return }

        NSWorkspace.shared.notificationCenter.removeObserver(self)
        onWake = nil
        onSleep = nil
        onNetworkChange = nil
        isMonitoring = false

        NSLog("[MacClaudeUsage] SystemEventHandler: Stopped monitoring system events")
    }

    /// Returns whether the system was asleep long enough to warrant an immediate fetch.
    func wasAsleepLongerThanStaleThreshold() -> Bool {
        guard let sleepTime = lastSleepTime, let wakeTime = lastWakeTime else {
            return false
        }
        return wakeTime.timeIntervalSince(sleepTime) > SystemEventHandler.staleThreshold
    }

    /// Returns the duration the system was asleep, or nil if unknown.
    func sleepDuration() -> TimeInterval? {
        guard let sleepTime = lastSleepTime, let wakeTime = lastWakeTime else {
            return nil
        }
        return wakeTime.timeIntervalSince(sleepTime)
    }

    // MARK: - Event Handlers

    @objc private func handleWake(_ notification: Notification) {
        lastWakeTime = Date()
        NSLog("[MacClaudeUsage] SystemEventHandler: System woke from sleep")

        if wasAsleepLongerThanStaleThreshold() {
            NSLog("[MacClaudeUsage] SystemEventHandler: Data is stale after sleep, triggering immediate fetch")
        }

        onWake?()
    }

    @objc private func handleSleep(_ notification: Notification) {
        lastSleepTime = Date()
        NSLog("[MacClaudeUsage] SystemEventHandler: System going to sleep")
        onSleep?()
    }

    @objc private func handleScreenWake(_ notification: Notification) {
        NSLog("[MacClaudeUsage] SystemEventHandler: Screen woke up")
        onWake?()
    }

    deinit {
        stopMonitoring()
    }
}
