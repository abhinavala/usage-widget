import Foundation

/// Centralized error handling and resilience system that coordinates error categorization,
/// retry logic, recovery actions, and logging across all Mac app components.
/// Provides robust operation under various failure conditions including authentication errors,
/// network failures, sync conflicts, and system-level issues.
class ErrorHandler {
    static let shared = ErrorHandler()

    private let retryManager: RetryManager
    private let recoveryActions: RecoveryActions
    private let errorLogger: ErrorLogger

    init(
        retryManager: RetryManager = .shared,
        recoveryActions: RecoveryActions = .shared,
        errorLogger: ErrorLogger = .shared
    ) {
        self.retryManager = retryManager
        self.recoveryActions = recoveryActions
        self.errorLogger = errorLogger
    }

    // MARK: - Public API

    /// Handles an error by categorizing it, logging it, and triggering the appropriate
    /// recovery action. This is the primary entry point for all error handling.
    func handleError(_ error: Error, context: String) {
        let category = categorizeError(error)
        let severity = determineSeverity(error)

        // Log the error
        logError(error, context: context, severity: severity)

        // Trigger recovery action
        let recoveryResult = triggerRecoveryAction(for: error, context: context)

        NSLog("[MacClaudeUsage] ErrorHandler: Handled %@ error in %@ — recovery: %@",
              category.rawValue, context,
              recoveryResult.succeeded ? "succeeded" : "failed")
    }

    /// Categorizes an error into an ErrorCategory for routing and metrics.
    func categorizeError(_ error: Error) -> ErrorCategory {
        return errorLogger.categorizeError(error)
    }

    /// Triggers the appropriate recovery action for the given error.
    /// Delegates to RecoveryActions for the actual recovery logic.
    func triggerRecoveryAction(for error: Error, context: String) -> RecoveryResult {
        return recoveryActions.triggerRecoveryAction(for: error, context: context)
    }

    /// Logs an error with the appropriate severity and context.
    func logError(_ error: Error, context: String, severity: ErrorSeverity = .error) {
        errorLogger.logError(error, context: context, severity: severity)
    }

    /// Executes an operation with retry logic and automatic error handling.
    /// On final failure, triggers recovery actions.
    func executeWithResilience(
        context: String,
        operation: () throws -> Void
    ) -> RetryResult {
        let result = retryManager.retryWithBackoff(context: context, operation: operation)

        if !result.succeeded, let lastError = result.lastError {
            handleError(lastError, context: context)
        }

        return result
    }

    /// Handles an authentication error specifically, triggering re-authentication flow.
    func handleAuthError(_ error: AuthError, context: String) {
        logError(error, context: context, severity: error.requiresReauth ? .critical : .error)

        if error.requiresReauth {
            let _ = triggerRecoveryAction(for: error, context: context)
            NSLog("[MacClaudeUsage] ErrorHandler: Auth error requires re-authentication in %@", context)
        }
    }

    /// Handles a fetch error, potentially retrying or switching fetcher strategy.
    func handleFetchError(_ error: FetchError, context: String) {
        logError(error, context: context)

        if error.retryable {
            NSLog("[MacClaudeUsage] ErrorHandler: Fetch error is retryable in %@", context)
        } else {
            let _ = triggerRecoveryAction(for: error, context: context)
        }
    }

    /// Determines the appropriate severity for an error.
    func determineSeverity(_ error: Error) -> ErrorSeverity {
        if let authError = error as? AuthError {
            return authError.requiresReauth ? .critical : .error
        }
        if let fetchError = error as? FetchError {
            if fetchError.retryable {
                return .warning
            }
            switch fetchError.code {
            case FetchErrorCode.serverError:
                return .critical
            default:
                return .error
            }
        }
        return .error
    }

    /// Returns current error metrics from the logger.
    func getErrorMetrics() -> ErrorMetrics {
        return errorLogger.getMetrics()
    }

    /// Returns recent error log entries.
    func getRecentErrors(count: Int = 50, category: ErrorCategory? = nil) -> [ErrorLogEntry] {
        return errorLogger.getRecentEntries(count: count, category: category)
    }

    /// Resets all error state, logs, and metrics.
    func reset() {
        errorLogger.reset()
        NSLog("[MacClaudeUsage] ErrorHandler: Reset all error state")
    }
}
