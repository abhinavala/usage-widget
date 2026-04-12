import Foundation

/// Configuration for a fetcher strategy.
struct FetcherConfig {
    var type: FetcherType
    var timeout: TimeInterval
    var retryAttempts: Int
}

/// Application-level settings controlling fetch behavior.
struct AppSettings {
    var fetchInterval: TimeInterval
    var staleThreshold: TimeInterval
    var autoFetch: Bool
    var selectedFetcher: FetcherType

    static let defaultSettings = AppSettings(
        fetchInterval: 300,
        staleThreshold: 900,
        autoFetch: true,
        selectedFetcher: .webapi
    )
}

/// Record of a single fetch attempt for debugging and strategy decisions.
struct FetchRecord {
    let timestamp: Date
    let fetcherType: FetcherType
    let success: Bool
    let error: FetchError?
    let duration: TimeInterval
}

/// Manages fetcher strategy selection and automatic fallback between WebAPI and CLI fetchers.
/// Tracks fetch history and switches strategies based on consecutive failure patterns.
class FetcherStrategy {
    static let shared = FetcherStrategy()

    private(set) var config: FetcherConfig
    private(set) var fetchHistory: [FetchRecord] = []
    private var consecutiveFailures: Int = 0

    /// Number of consecutive failures before switching to fallback strategy.
    static let failoverThreshold = 3

    /// Maximum fetch history entries to retain.
    static let maxHistorySize = 100

    /// Default timeout for fetch requests in seconds.
    static let defaultTimeout: TimeInterval = 30

    /// Default retry attempts per fetch.
    static let defaultRetryAttempts: Int = 3

    init(config: FetcherConfig? = nil) {
        self.config = config ?? FetcherConfig(
            type: .webapi,
            timeout: FetcherStrategy.defaultTimeout,
            retryAttempts: FetcherStrategy.defaultRetryAttempts
        )
    }

    /// Returns the currently configured fetcher type.
    func currentFetcherType() -> FetcherType {
        return config.type
    }

    /// Fetches usage data using the current strategy, with automatic fallback on failure.
    func fetchWithStrategy(primary: UsageFetcher, fallback: UsageFetcher) throws -> UsageData {
        let startTime = Date()
        let activeFetcher: UsageFetcher = config.type == .webapi ? primary : fallback

        do {
            let data = try activeFetcher.fetchUsage()
            recordSuccess(startTime: startTime)
            return data
        } catch let error as FetchError {
            recordFailure(startTime: startTime, error: error)

            if shouldSwitchStrategy() {
                switchFetcherStrategy()
                let fallbackFetcher: UsageFetcher = config.type == .webapi ? primary : fallback
                let retryStart = Date()
                do {
                    let data = try fallbackFetcher.fetchUsage()
                    recordSuccess(startTime: retryStart)
                    return data
                } catch let retryError as FetchError {
                    recordFailure(startTime: retryStart, error: retryError)
                    throw retryError
                }
            }

            throw error
        }
    }

    /// Switches the fetcher strategy between WebAPI and CLI.
    /// Called automatically when consecutive failures reach the failover threshold,
    /// or can be called manually to force a strategy change.
    func switchFetcherStrategy() {
        let previousType = config.type
        config.type = config.type == .webapi ? .cli : .webapi
        consecutiveFailures = 0
        NSLog("[MacClaudeUsage] FetcherStrategy: Switched from %@ to %@", previousType.rawValue, config.type.rawValue)
    }

    /// Updates the fetcher configuration.
    func updateConfig(_ newConfig: FetcherConfig) {
        config = newConfig
        consecutiveFailures = 0
        NSLog("[MacClaudeUsage] FetcherStrategy: Config updated to type=%@, timeout=%.0f, retries=%d",
              config.type.rawValue, config.timeout, config.retryAttempts)
    }

    /// Resets the strategy to its default state (WebAPI primary).
    func reset() {
        config = FetcherConfig(
            type: .webapi,
            timeout: FetcherStrategy.defaultTimeout,
            retryAttempts: FetcherStrategy.defaultRetryAttempts
        )
        consecutiveFailures = 0
        fetchHistory.removeAll()
        NSLog("[MacClaudeUsage] FetcherStrategy: Reset to default configuration")
    }

    // MARK: - Private

    private func recordSuccess(startTime: Date) {
        let record = FetchRecord(
            timestamp: startTime,
            fetcherType: config.type,
            success: true,
            error: nil,
            duration: Date().timeIntervalSince(startTime)
        )
        appendHistory(record)
        consecutiveFailures = 0
    }

    private func recordFailure(startTime: Date, error: FetchError) {
        let record = FetchRecord(
            timestamp: startTime,
            fetcherType: config.type,
            success: false,
            error: error,
            duration: Date().timeIntervalSince(startTime)
        )
        appendHistory(record)
        consecutiveFailures += 1
        NSLog("[MacClaudeUsage] FetcherStrategy: Fetch failed (%d consecutive), error: %@",
              consecutiveFailures, error.code)
    }

    private func appendHistory(_ record: FetchRecord) {
        fetchHistory.append(record)
        if fetchHistory.count > FetcherStrategy.maxHistorySize {
            fetchHistory.removeFirst(fetchHistory.count - FetcherStrategy.maxHistorySize)
        }
    }

    private func shouldSwitchStrategy() -> Bool {
        return consecutiveFailures >= FetcherStrategy.failoverThreshold
    }
}
