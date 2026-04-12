import Foundation
import Combine

/// Manages automatic data fetching on 5-minute intervals with strategy-based fallback.
/// Handles timer lifecycle, system sleep/wake events, immediate fetches, and error recovery.
class FetchScheduler {
    static let shared = FetchScheduler()

    /// Default fetch interval: 5 minutes (300 seconds).
    static let defaultFetchInterval: TimeInterval = 300

    /// Exponential backoff base delay in seconds.
    static let backoffBaseDelay: TimeInterval = 5

    /// Maximum backoff delay in seconds.
    static let maxBackoffDelay: TimeInterval = 120

    private(set) var timer: Timer?
    private(set) var isRunning: Bool = false
    private(set) var lastFetchTime: Date?
    private(set) var nextFetchTime: Date?
    private(set) var lastUsageData: UsageData?
    private(set) var backoffMultiplier: Int = 0

    private let fetcherStrategy: FetcherStrategy
    private let systemEventHandler: SystemEventHandler
    private let systemStatusManager: SystemStatusManager
    private var settings: AppSettings
    private var primaryFetcher: UsageFetcher?
    private var fallbackFetcher: UsageFetcher?

    init(
        fetcherStrategy: FetcherStrategy = .shared,
        systemEventHandler: SystemEventHandler = .shared,
        systemStatusManager: SystemStatusManager = .shared,
        settings: AppSettings = .defaultSettings
    ) {
        self.fetcherStrategy = fetcherStrategy
        self.systemEventHandler = systemEventHandler
        self.systemStatusManager = systemStatusManager
        self.settings = settings
    }

    // MARK: - Configuration

    /// Configures the fetchers used by the scheduler.
    func configureFetchers(primary: UsageFetcher, fallback: UsageFetcher) {
        self.primaryFetcher = primary
        self.fallbackFetcher = fallback
        NSLog("[MacClaudeUsage] FetchScheduler: Fetchers configured (primary: webapi, fallback: cli)")
    }

    /// Updates the scheduler settings.
    func updateSettings(_ newSettings: AppSettings) {
        let needsRestart = isRunning && newSettings.fetchInterval != settings.fetchInterval
        settings = newSettings
        if needsRestart {
            stopScheduledFetching()
            startScheduledFetching()
        }
        NSLog("[MacClaudeUsage] FetchScheduler: Settings updated (interval: %.0fs, autoFetch: %@)",
              settings.fetchInterval, settings.autoFetch ? "true" : "false")
    }

    // MARK: - Scheduling

    /// Starts the scheduled fetching timer and performs the first fetch.
    /// Timer fires every `settings.fetchInterval` seconds (default 300s / 5 minutes).
    /// Also begins monitoring system events (sleep/wake) to handle data staleness.
    func startScheduledFetching() {
        guard !isRunning else {
            NSLog("[MacClaudeUsage] FetchScheduler: Already running, ignoring duplicate start")
            return
        }

        guard settings.autoFetch else {
            NSLog("[MacClaudeUsage] FetchScheduler: autoFetch is disabled, not starting")
            return
        }

        isRunning = true
        systemStatusManager.markRunning(true)

        // Start system event monitoring for sleep/wake handling
        systemEventHandler.startMonitoring(
            onWake: { [weak self] in
                self?.handleSystemWake()
            },
            onSleep: { [weak self] in
                self?.handleSystemSleep()
            }
        )

        // Schedule repeating timer
        scheduleTimer()

        // Perform initial fetch
        performScheduledFetch()

        NSLog("[MacClaudeUsage] FetchScheduler: Started scheduled fetching (interval: %.0fs)", settings.fetchInterval)
    }

    /// Stops the scheduled fetching timer and system event monitoring.
    func stopScheduledFetching() {
        guard isRunning else { return }

        timer?.invalidate()
        timer = nil
        isRunning = false
        nextFetchTime = nil
        backoffMultiplier = 0
        systemStatusManager.markRunning(false)
        systemEventHandler.stopMonitoring()

        NSLog("[MacClaudeUsage] FetchScheduler: Stopped scheduled fetching")
    }

    // MARK: - Immediate Fetch

    /// Performs an immediate fetch bypassing the timer schedule.
    /// Returns the fetched UsageData, or throws if the fetch fails.
    @discardableResult
    func performImmediateFetch() throws -> UsageData {
        NSLog("[MacClaudeUsage] FetchScheduler: Performing immediate fetch")

        guard let primary = primaryFetcher, let fallback = fallbackFetcher else {
            throw FetchError(
                message: "Fetchers not configured. Call configureFetchers() first.",
                code: FetchErrorCode.networkError,
                fetcherType: fetcherStrategy.currentFetcherType(),
                retryable: false
            )
        }

        let data = try fetcherStrategy.fetchWithStrategy(primary: primary, fallback: fallback)
        lastUsageData = data
        lastFetchTime = Date()
        backoffMultiplier = 0
        systemStatusManager.recordFetch(at: lastFetchTime!, nextFetchIn: settings.fetchInterval)
        nextFetchTime = systemStatusManager.getSystemStatus().nextFetchTime

        NSLog("[MacClaudeUsage] FetchScheduler: Immediate fetch completed successfully")
        return data
    }

    // MARK: - Strategy

    /// Switches the fetcher strategy between WebAPI and CLI.
    /// Delegates to FetcherStrategy and resets the backoff multiplier.
    func switchFetcherStrategy() {
        fetcherStrategy.switchFetcherStrategy()
        backoffMultiplier = 0
        NSLog("[MacClaudeUsage] FetchScheduler: Strategy switched to %@", fetcherStrategy.currentFetcherType().rawValue)
    }

    /// Returns the current fetcher configuration.
    func currentFetcherConfig() -> FetcherConfig {
        return fetcherStrategy.config
    }

    // MARK: - Status

    /// Returns the current scheduler status as a SystemStatus snapshot.
    func getSchedulerStatus() -> SystemStatus {
        return systemStatusManager.getSystemStatus()
    }

    /// Returns whether the last fetched data is considered stale.
    func isDataStale() -> Bool {
        guard let lastFetch = lastFetchTime else { return true }
        return Date().timeIntervalSince(lastFetch) > settings.staleThreshold
    }

    // MARK: - Private

    private func scheduleTimer() {
        timer?.invalidate()

        let interval = settings.fetchInterval
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.performScheduledFetch()
        }
        timer?.tolerance = 10
        nextFetchTime = Date().addingTimeInterval(interval)
        systemStatusManager.recordFetch(at: lastFetchTime ?? Date(), nextFetchIn: interval)

        NSLog("[MacClaudeUsage] FetchScheduler: Timer scheduled (interval: %.0fs)", interval)
    }

    private func performScheduledFetch() {
        guard let primary = primaryFetcher, let fallback = fallbackFetcher else {
            NSLog("[MacClaudeUsage] FetchScheduler: Skipping fetch — fetchers not configured")
            return
        }

        do {
            let data = try fetcherStrategy.fetchWithStrategy(primary: primary, fallback: fallback)
            lastUsageData = data
            lastFetchTime = Date()
            backoffMultiplier = 0
            systemStatusManager.recordFetch(at: lastFetchTime!, nextFetchIn: settings.fetchInterval)
            nextFetchTime = systemStatusManager.getSystemStatus().nextFetchTime

            NSLog("[MacClaudeUsage] FetchScheduler: Scheduled fetch completed (tokens: %d/%d)",
                  data.tokensUsed, data.tokensLimit)
        } catch {
            backoffMultiplier = min(backoffMultiplier + 1, 5)
            let backoffDelay = FetchScheduler.backoffBaseDelay * pow(2.0, Double(backoffMultiplier))
            let clampedDelay = min(backoffDelay, FetchScheduler.maxBackoffDelay)

            NSLog("[MacClaudeUsage] FetchScheduler: Scheduled fetch failed (backoff: %.0fs) - %@",
                  clampedDelay, error.localizedDescription)
        }
    }

    private func handleSystemWake() {
        NSLog("[MacClaudeUsage] FetchScheduler: Handling system wake")

        if systemEventHandler.wasAsleepLongerThanStaleThreshold() || isDataStale() {
            NSLog("[MacClaudeUsage] FetchScheduler: Data stale after wake, performing immediate fetch")
            performScheduledFetch()
        }

        // Reschedule timer to maintain consistent intervals from wake time
        if isRunning {
            scheduleTimer()
        }
    }

    private func handleSystemSleep() {
        NSLog("[MacClaudeUsage] FetchScheduler: Handling system sleep — timer will pause")
    }
}
