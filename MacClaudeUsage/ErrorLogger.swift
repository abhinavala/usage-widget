import Foundation
import os.log

/// Categories of errors for structured logging and metrics.
enum ErrorCategory: String {
    case authentication = "authentication"
    case network = "network"
    case parsing = "parsing"
    case sync = "sync"
    case system = "system"
    case unknown = "unknown"
}

/// Severity levels for error logging.
enum ErrorSeverity: String {
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"
    case critical = "CRITICAL"
}

/// A single error log entry for tracking and debugging.
struct ErrorLogEntry {
    let timestamp: Date
    let category: ErrorCategory
    let severity: ErrorSeverity
    let code: String
    let message: String
    let context: String
    let recoveryAttempted: Bool
    let recoverySucceeded: Bool?
}

/// Metrics snapshot for error tracking.
struct ErrorMetrics {
    var totalErrors: Int = 0
    var errorsByCategory: [ErrorCategory: Int] = [:]
    var errorsBySeverity: [ErrorSeverity: Int] = [:]
    var recoveryAttempts: Int = 0
    var recoverySuccesses: Int = 0
}

/// Centralized error logging system that records, categorizes, and reports errors
/// without exposing sensitive data. Uses os.log for system-level logging and
/// maintains an in-memory log for metrics and debugging.
class ErrorLogger {
    static let shared = ErrorLogger()

    /// Maximum number of log entries to retain in memory.
    static let maxLogEntries = 500

    private(set) var logEntries: [ErrorLogEntry] = []
    private(set) var metrics: ErrorMetrics = ErrorMetrics()

    private let logger = OSLog(subsystem: "com.macclaudeusage.app", category: "errors")

    init() {}

    // MARK: - Public API

    /// Logs an error with the given category, severity, and context.
    func logError(
        category: ErrorCategory,
        severity: ErrorSeverity,
        code: String,
        message: String,
        context: String,
        recoveryAttempted: Bool = false,
        recoverySucceeded: Bool? = nil
    ) {
        let entry = ErrorLogEntry(
            timestamp: Date(),
            category: category,
            severity: severity,
            code: code,
            message: sanitizeMessage(message),
            context: context,
            recoveryAttempted: recoveryAttempted,
            recoverySucceeded: recoverySucceeded
        )

        appendEntry(entry)
        updateMetrics(entry)
        emitOSLog(entry)
    }

    /// Logs an Error object with automatic categorization.
    func logError(_ error: Error, context: String, severity: ErrorSeverity = .error) {
        let category = categorizeError(error)
        let code = errorCode(from: error)
        let message = errorMessage(from: error)

        logError(
            category: category,
            severity: severity,
            code: code,
            message: message,
            context: context
        )
    }

    /// Logs a recovery attempt result.
    func logRecoveryAttempt(
        error: Error,
        context: String,
        succeeded: Bool
    ) {
        let category = categorizeError(error)
        let code = errorCode(from: error)
        let message = errorMessage(from: error)

        logError(
            category: category,
            severity: succeeded ? .info : .warning,
            code: code,
            message: "Recovery \(succeeded ? "succeeded" : "failed"): \(message)",
            context: context,
            recoveryAttempted: true,
            recoverySucceeded: succeeded
        )
    }

    /// Returns current error metrics.
    func getMetrics() -> ErrorMetrics {
        return metrics
    }

    /// Returns recent log entries, optionally filtered by category.
    func getRecentEntries(count: Int = 50, category: ErrorCategory? = nil) -> [ErrorLogEntry] {
        var entries = logEntries
        if let category = category {
            entries = entries.filter { $0.category == category }
        }
        return Array(entries.suffix(count))
    }

    /// Resets all log entries and metrics.
    func reset() {
        logEntries.removeAll()
        metrics = ErrorMetrics()
        NSLog("[MacClaudeUsage] ErrorLogger: Reset all logs and metrics")
    }

    // MARK: - Error Categorization

    /// Categorizes an error into an ErrorCategory.
    func categorizeError(_ error: Error) -> ErrorCategory {
        if error is AuthError {
            return .authentication
        }
        if let fetchError = error as? FetchError {
            switch fetchError.code {
            case FetchErrorCode.networkTimeout, FetchErrorCode.networkError:
                return .network
            case FetchErrorCode.parseError, FetchErrorCode.invalidResponse:
                return .parsing
            case FetchErrorCode.credentialsExpired, FetchErrorCode.authenticationFailed:
                return .authentication
            default:
                return .network
            }
        }
        return .unknown
    }

    // MARK: - Private

    private func appendEntry(_ entry: ErrorLogEntry) {
        logEntries.append(entry)
        if logEntries.count > ErrorLogger.maxLogEntries {
            logEntries.removeFirst(logEntries.count - ErrorLogger.maxLogEntries)
        }
    }

    private func updateMetrics(_ entry: ErrorLogEntry) {
        metrics.totalErrors += 1
        metrics.errorsByCategory[entry.category, default: 0] += 1
        metrics.errorsBySeverity[entry.severity, default: 0] += 1
        if entry.recoveryAttempted {
            metrics.recoveryAttempts += 1
            if entry.recoverySucceeded == true {
                metrics.recoverySuccesses += 1
            }
        }
    }

    private func emitOSLog(_ entry: ErrorLogEntry) {
        let logType: OSLogType
        switch entry.severity {
        case .info:
            logType = .info
        case .warning:
            logType = .default
        case .error:
            logType = .error
        case .critical:
            logType = .fault
        }

        os_log("%{public}@ [%{public}@] %{public}@: %{public}@",
               log: logger, type: logType,
               entry.severity.rawValue,
               entry.category.rawValue,
               entry.context,
               entry.message)
    }

    private func errorCode(from error: Error) -> String {
        if let authError = error as? AuthError {
            return authError.code
        }
        if let fetchError = error as? FetchError {
            return fetchError.code
        }
        return "UNKNOWN_ERROR"
    }

    private func errorMessage(from error: Error) -> String {
        if let authError = error as? AuthError {
            return authError.message
        }
        if let fetchError = error as? FetchError {
            return fetchError.message
        }
        return error.localizedDescription
    }

    /// Removes potentially sensitive data from error messages.
    private func sanitizeMessage(_ message: String) -> String {
        var sanitized = message
        // Remove potential tokens/session IDs (long hex or base64 strings)
        let tokenPattern = "[a-zA-Z0-9+/=_-]{32,}"
        if let regex = try? NSRegularExpression(pattern: tokenPattern) {
            sanitized = regex.stringByReplacingMatches(
                in: sanitized,
                range: NSRange(sanitized.startIndex..., in: sanitized),
                withTemplate: "[REDACTED]"
            )
        }
        return sanitized
    }
}
