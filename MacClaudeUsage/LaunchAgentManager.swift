import Foundation

/// Configuration for the LaunchAgent plist.
struct LaunchAgentConfig {
    let keepAlive: Bool
    let runAtLoad: Bool
    let startInterval: Int

    static let `default` = LaunchAgentConfig(
        keepAlive: true,
        runAtLoad: true,
        startInterval: 300
    )
}

/// Manages installation and removal of the macOS LaunchAgent for auto-start and auto-restart.
class LaunchAgentManager {
    static let launchAgentLabel = "com.claudeusage.mac"

    private var launchAgentURL: URL {
        let libraryURL = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library")
            .appendingPathComponent("LaunchAgents")
        return libraryURL.appendingPathComponent("\(Self.launchAgentLabel).plist")
    }

    private let config: LaunchAgentConfig

    init(config: LaunchAgentConfig = .default) {
        self.config = config
    }

    /// Installs the LaunchAgent plist if it does not already exist.
    func installLaunchAgentIfNeeded() {
        guard !FileManager.default.fileExists(atPath: launchAgentURL.path) else {
            NSLog("[MacClaudeUsage] LaunchAgent already installed at \(launchAgentURL.path)")
            return
        }
        install()
    }

    /// Installs (or overwrites) the LaunchAgent plist.
    func install() {
        let plistDict = buildPlistDictionary()
        do {
            let launchAgentsDir = launchAgentURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: launchAgentsDir, withIntermediateDirectories: true)
            let data = try PropertyListSerialization.data(fromPropertyList: plistDict, format: .xml, options: 0)
            try data.write(to: launchAgentURL, options: .atomic)
            NSLog("[MacClaudeUsage] LaunchAgent installed at \(launchAgentURL.path)")
        } catch {
            NSLog("[MacClaudeUsage] Failed to install LaunchAgent: \(error)")
        }
    }

    /// Removes the LaunchAgent plist.
    func uninstall() {
        do {
            try FileManager.default.removeItem(at: launchAgentURL)
            NSLog("[MacClaudeUsage] LaunchAgent removed")
        } catch {
            NSLog("[MacClaudeUsage] Failed to remove LaunchAgent: \(error)")
        }
    }

    /// Returns the path where the LaunchAgent plist is (or would be) installed.
    func installedPath() -> String {
        return launchAgentURL.path
    }

    /// Builds the LaunchAgent plist dictionary from the current config.
    func buildPlistDictionary() -> [String: Any] {
        guard let executablePath = Bundle.main.executablePath else {
            NSLog("[MacClaudeUsage] Warning: Could not determine executable path")
            return [:]
        }

        return [
            "Label": Self.launchAgentLabel,
            "ProgramArguments": [executablePath],
            "KeepAlive": config.keepAlive,
            "RunAtLoad": config.runAtLoad,
            "StartInterval": config.startInterval,
            "ProcessType": "Background",
            "StandardOutPath": "/tmp/MacClaudeUsage.stdout.log",
            "StandardErrorPath": "/tmp/MacClaudeUsage.stderr.log"
        ]
    }
}
