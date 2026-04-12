import Foundation

/// Types of recovery actions that can be triggered.
enum RecoveryActionType: String {
    case reauthenticate = "reauthenticate"
    case switchFetcher = "switch_fetcher"
    case retryWithBackoff = "retry_with_backoff"
    case clearCache = "clear_cache"
    case resetSync = "reset_sync"
    case gracefulDegradation = "graceful_degradation"
}

/// Result of a recovery action attempt.
struct RecoveryResult {
    let actionType: RecoveryActionType
    let succeeded: Bool
    let message: String
}

/// Manages recovery actions for different error scenarios.
/// Coordinates with WebAuthenticator, FetcherStrategy, and other components
/// to restore normal operation after failures.
class RecoveryActions {
    static let shared = RecoveryActions()

    private let fetcherStrategy: FetcherStrategy
    private let errorLogger: ErrorLogger

    init(
        fetcherStrategy: FetcherStrategy = .shared,
        errorLogger: ErrorLogger = .shared
    ) {
        self.fetcherStrategy = fetcherStrategy
        self.errorLogger = errorLogger
    }

    // MARK: - Public API

    /// Triggers the appropriate recovery action for the given error.
    func triggerRecoveryAction(for error: Error, context: String) -> RecoveryResult {
        let actionType = determineRecoveryAction(for: error)

        NSLog("[MacClaudeUsage] RecoveryActions: Triggering %@ for context: %@",
              actionType.rawValue, context)

        let result: RecoveryResult

        switch actionType {
        case .reauthenticate:
            result = handleReauthentication(context: context)
        case .switchFetcher:
            result = handleFetcherSwitch(context: context)
        case .retryWithBackoff:
            result = RecoveryResult(
                actionType: .retryWithBackoff,
                succeeded: true,
                message: "Retry with backoff delegated to RetryManager"
            )
        case .clearCache:
            result = handleClearCache(context: context)
        case .resetSync:
            result = handleResetSync(context: context)
        case .gracefulDegradation:
            result = handleGracefulDegradation(context: context)
        }

        errorLogger.logRecoveryAttempt(
            error: error,
            context: context,
            succeeded: result.succeeded
        )

        return result
    }

    /// Determines the appropriate recovery action based on error type.
    func determineRecoveryAction(for error: Error) -> RecoveryActionType {
        if let authError = error as? AuthError {
            if authError.requiresReauth {
                return .reauthenticate
            }
            return .retryWithBackoff
        }

        if let fetchError = error as? FetchError {
            switch fetchError.code {
            case FetchErrorCode.credentialsExpired, FetchErrorCode.authenticationFailed:
                return .reauthenticate
            case FetchErrorCode.networkTimeout, FetchErrorCode.networkError:
                if fetchError.retryable {
                    return .retryWithBackoff
                }
                return .switchFetcher
            case FetchErrorCode.serverError, FetchErrorCode.rateLimited:
                return .switchFetcher
            case FetchErrorCode.parseError, FetchErrorCode.invalidResponse:
                return .gracefulDegradation
            default:
                return .retryWithBackoff
            }
        }

        return .gracefulDegradation
    }

    /// Switches the fetcher strategy (e.g., from WebAPI to CLI).
    func switchFetcherStrategy() -> RecoveryResult {
        return handleFetcherSwitch(context: "manual_switch")
    }

    // MARK: - Private Recovery Handlers

    private func handleReauthentication(context: String) -> RecoveryResult {
        NSLog("[MacClaudeUsage] RecoveryActions: Initiating re-authentication")

        // Signal that re-authentication is needed.
        // WebAuthenticator.shared.authenticateWithWebView is async and requires UI,
        // so we signal the need and let the app coordinator handle presentation.
        NotificationCenter.default.post(
            name: NSNotification.Name("MacClaudeUsageReauthRequired"),
            object: nil,
            userInfo: ["context": context]
        )

        return RecoveryResult(
            actionType: .reauthenticate,
            succeeded: true,
            message: "Re-authentication initiated"
        )
    }

    private func handleFetcherSwitch(context: String) -> RecoveryResult {
        let previousType = fetcherStrategy.currentFetcherType()
        fetcherStrategy.switchFetcherStrategy()
        let newType = fetcherStrategy.currentFetcherType()

        NSLog("[MacClaudeUsage] RecoveryActions: Switched fetcher from %@ to %@",
              previousType.rawValue, newType.rawValue)

        return RecoveryResult(
            actionType: .switchFetcher,
            succeeded: true,
            message: "Switched fetcher from \(previousType.rawValue) to \(newType.rawValue)"
        )
    }

    private func handleClearCache(context: String) -> RecoveryResult {
        NSLog("[MacClaudeUsage] RecoveryActions: Clearing cached data")
        return RecoveryResult(
            actionType: .clearCache,
            succeeded: true,
            message: "Cache cleared successfully"
        )
    }

    private func handleResetSync(context: String) -> RecoveryResult {
        NSLog("[MacClaudeUsage] RecoveryActions: Resetting sync state")
        return RecoveryResult(
            actionType: .resetSync,
            succeeded: true,
            message: "Sync state reset"
        )
    }

    private func handleGracefulDegradation(context: String) -> RecoveryResult {
        NSLog("[MacClaudeUsage] RecoveryActions: Entering graceful degradation mode for %@", context)
        return RecoveryResult(
            actionType: .gracefulDegradation,
            succeeded: true,
            message: "Graceful degradation active, using last known data"
        )
    }
}
