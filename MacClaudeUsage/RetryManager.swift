import Foundation

/// Configuration for retry behavior.
struct RetryConfig {
    var maxRetries: Int
    var baseDelay: TimeInterval
    var maxDelay: TimeInterval
    var backoffMultiplier: Double

    static let defaultConfig = RetryConfig(
        maxRetries: 3,
        baseDelay: 1.0,
        maxDelay: 60.0,
        backoffMultiplier: 2.0
    )
}

/// Result of a retry operation.
struct RetryResult {
    let succeeded: Bool
    let attempts: Int
    let lastError: Error?
    let finalDelay: TimeInterval
}

/// Manages retry logic with exponential backoff for recoverable errors.
/// Determines whether errors are retryable and calculates appropriate delays
/// between attempts.
class RetryManager {
    static let shared = RetryManager()

    private let config: RetryConfig
    private let errorLogger: ErrorLogger

    init(config: RetryConfig = .defaultConfig, errorLogger: ErrorLogger = .shared) {
        self.config = config
        self.errorLogger = errorLogger
    }

    // MARK: - Public API

    /// Executes an operation with exponential backoff retry logic.
    /// Only retries if the error is determined to be retryable.
    func retryWithBackoff(
        context: String,
        operation: () throws -> Void
    ) -> RetryResult {
        var lastError: Error?
        var delay: TimeInterval = config.baseDelay

        for attempt in 1...(config.maxRetries + 1) {
            do {
                try operation()
                if attempt > 1 {
                    errorLogger.logError(
                        category: .system,
                        severity: .info,
                        code: "RETRY_SUCCESS",
                        message: "Operation succeeded after \(attempt) attempts",
                        context: context
                    )
                }
                return RetryResult(
                    succeeded: true,
                    attempts: attempt,
                    lastError: nil,
                    finalDelay: delay
                )
            } catch {
                lastError = error

                if !isRetryable(error) {
                    errorLogger.logError(
                        category: errorLogger.categorizeError(error),
                        severity: .error,
                        code: "NON_RETRYABLE",
                        message: "Non-retryable error: \(error.localizedDescription)",
                        context: context
                    )
                    return RetryResult(
                        succeeded: false,
                        attempts: attempt,
                        lastError: error,
                        finalDelay: delay
                    )
                }

                if attempt <= config.maxRetries {
                    NSLog("[MacClaudeUsage] RetryManager: Attempt %d/%d failed for %@, retrying in %.1fs",
                          attempt, config.maxRetries + 1, context, delay)

                    errorLogger.logError(
                        category: errorLogger.categorizeError(error),
                        severity: .warning,
                        code: "RETRY_ATTEMPT",
                        message: "Attempt \(attempt) failed, retrying in \(delay)s",
                        context: context
                    )

                    Thread.sleep(forTimeInterval: delay)
                    delay = calculateNextDelay(currentDelay: delay)
                }
            }
        }

        errorLogger.logError(
            category: lastError.map { errorLogger.categorizeError($0) } ?? .unknown,
            severity: .error,
            code: "MAX_RETRIES_EXCEEDED",
            message: "All \(config.maxRetries + 1) attempts failed",
            context: context
        )

        return RetryResult(
            succeeded: false,
            attempts: config.maxRetries + 1,
            lastError: lastError,
            finalDelay: delay
        )
    }

    /// Determines if an error is retryable.
    func isRetryable(_ error: Error) -> Bool {
        if let authError = error as? AuthError {
            // Auth errors requiring re-auth are not retryable via simple retry
            return !authError.requiresReauth
        }
        if let fetchError = error as? FetchError {
            return fetchError.retryable
        }
        // Unknown errors are not retried by default
        return false
    }

    /// Calculates the delay for the next retry using exponential backoff.
    func calculateNextDelay(currentDelay: TimeInterval) -> TimeInterval {
        let nextDelay = currentDelay * config.backoffMultiplier
        return min(nextDelay, config.maxDelay)
    }

    /// Returns the delay for a given attempt number (0-indexed).
    func delayForAttempt(_ attempt: Int) -> TimeInterval {
        let delay = config.baseDelay * pow(config.backoffMultiplier, Double(attempt))
        return min(delay, config.maxDelay)
    }
}
