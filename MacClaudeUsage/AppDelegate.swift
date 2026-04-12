import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
    private let statusManager = SystemStatusManager.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSLog("[MacClaudeUsage] Application did finish launching")
        statusManager.updateVisibility(.background)
        statusManager.markRunning(true)
    }

    func applicationWillTerminate(_ notification: Notification) {
        NSLog("[MacClaudeUsage] Application will terminate")
        statusManager.markRunning(false)
        performCleanShutdown()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Keep running even with no windows (background app)
        return false
    }

    /// Performs a clean shutdown: saves state and logs termination.
    private func performCleanShutdown() {
        NSLog("[MacClaudeUsage] Performing clean shutdown...")
        statusManager.updateVisibility(.hidden)
        NSLog("[MacClaudeUsage] Clean shutdown complete")
    }
}
