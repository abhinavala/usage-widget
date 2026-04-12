import Cocoa

@main
struct MacClaudeUsageApp {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate

        // Configure as LSUIElement (accessory app - no dock icon, no menu bar)
        app.setActivationPolicy(.accessory)

        initializeApp()

        app.run()
    }

    /// Initializes the app: sets up launch agent, logging, and system status.
    static func initializeApp() {
        NSLog("[MacClaudeUsage] Initializing app...")

        // Set up launch agent for auto-start
        let launchAgentManager = LaunchAgentManager()
        launchAgentManager.setupLaunchAgent()

        // Initialize system status
        let statusManager = SystemStatusManager.shared
        statusManager.updateVisibility(.hidden)
        statusManager.markRunning(true)

        NSLog("[MacClaudeUsage] App initialized successfully. Visibility: hidden, ActivationPolicy: accessory")
    }
}
