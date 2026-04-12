import Foundation

/// Parsed usage data from Claude.ai API responses.
struct UsageData {
    var tokensUsed: Int
    var tokensLimit: Int
    var messagesUsed: Int
    var messagesLimit: Int
    var resetTime: Date
    var lastUpdated: Date
}

/// Error codes for fetch operations.
enum FetchErrorCode {
    static let networkTimeout = "NETWORK_TIMEOUT"
    static let networkError = "NETWORK_ERROR"
    static let parseError = "PARSE_ERROR"
    static let rateLimited = "RATE_LIMITED"
    static let credentialsExpired = "CREDENTIALS_EXPIRED"
    static let authenticationFailed = "AUTHENTICATION_FAILED"
    static let invalidResponse = "INVALID_RESPONSE"
    static let serverError = "SERVER_ERROR"
}

/// Fetcher type identifier.
enum FetcherType: String {
    case webapi
    case cli
}

/// Error type for fetch operations.
class FetchError: Error {
    let code: String
    let message: String
    let fetcherType: FetcherType
    let retryable: Bool

    init(message: String, code: String, fetcherType: FetcherType = .webapi, retryable: Bool = false) {
        self.message = message
        self.code = code
        self.fetcherType = fetcherType
        self.retryable = retryable
    }

    var localizedDescription: String {
        return "\(message) (code: \(code), retryable: \(retryable))"
    }
}

/// Parses Claude.ai API and HTML responses into UsageData.
class ResponseParser {

    // MARK: - Parse API JSON Response

    /// Parses a JSON API response body into UsageData.
    func parseAPIResponse(_ data: Data) throws -> UsageData {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw FetchError(
                message: "Failed to parse API response as JSON",
                code: FetchErrorCode.parseError,
                retryable: false
            )
        }

        return try extractUsageFromJSON(json)
    }

    // MARK: - Parse HTML Response

    /// Parses an HTML response body to extract usage data.
    func parseHTMLResponse(_ data: Data) throws -> UsageData {
        guard let html = String(data: data, encoding: .utf8) else {
            throw FetchError(
                message: "Failed to decode HTML response as UTF-8",
                code: FetchErrorCode.parseError,
                retryable: false
            )
        }

        return try extractUsageFromHTML(html)
    }

    // MARK: - Parse Response (auto-detect format)

    /// Parses a response, auto-detecting JSON or HTML format.
    func parseResponse(_ data: Data, contentType: String?) throws -> UsageData {
        if let contentType = contentType, contentType.contains("application/json") {
            return try parseAPIResponse(data)
        }

        // Try JSON first, fall back to HTML
        if let _ = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return try parseAPIResponse(data)
        }

        return try parseHTMLResponse(data)
    }

    // MARK: - Private Helpers

    /// Extracts usage data from a parsed JSON dictionary.
    private func extractUsageFromJSON(_ json: [String: Any]) throws -> UsageData {
        guard let tokensUsed = json["tokensUsed"] as? Int ?? json["tokens_used"] as? Int,
              let tokensLimit = json["tokensLimit"] as? Int ?? json["tokens_limit"] as? Int,
              let messagesUsed = json["messagesUsed"] as? Int ?? json["messages_used"] as? Int,
              let messagesLimit = json["messagesLimit"] as? Int ?? json["messages_limit"] as? Int else {
            throw FetchError(
                message: "Missing required usage fields in API response",
                code: FetchErrorCode.parseError,
                retryable: false
            )
        }

        let resetTime = parseResetTime(from: json)
        let lastUpdated = Date()

        return UsageData(
            tokensUsed: tokensUsed,
            tokensLimit: tokensLimit,
            messagesUsed: messagesUsed,
            messagesLimit: messagesLimit,
            resetTime: resetTime,
            lastUpdated: lastUpdated
        )
    }

    /// Extracts usage data from HTML string using pattern matching.
    private func extractUsageFromHTML(_ html: String) throws -> UsageData {
        let tokensUsed = extractNumber(from: html, pattern: "tokens[_\\s-]?used[\"':=\\s]+(\\d+)")
            ?? extractNumber(from: html, pattern: "(\\d+)\\s*(?:of|/)\\s*\\d+\\s*tokens")
        let tokensLimit = extractNumber(from: html, pattern: "tokens[_\\s-]?limit[\"':=\\s]+(\\d+)")
            ?? extractNumber(from: html, pattern: "\\d+\\s*(?:of|/)\\s*(\\d+)\\s*tokens")
        let messagesUsed = extractNumber(from: html, pattern: "messages[_\\s-]?used[\"':=\\s]+(\\d+)")
            ?? extractNumber(from: html, pattern: "(\\d+)\\s*(?:of|/)\\s*\\d+\\s*messages")
        let messagesLimit = extractNumber(from: html, pattern: "messages[_\\s-]?limit[\"':=\\s]+(\\d+)")
            ?? extractNumber(from: html, pattern: "\\d+\\s*(?:of|/)\\s*(\\d+)\\s*messages")

        guard let tUsed = tokensUsed, let tLimit = tokensLimit,
              let mUsed = messagesUsed, let mLimit = messagesLimit else {
            throw FetchError(
                message: "Could not extract usage data from HTML response",
                code: FetchErrorCode.parseError,
                retryable: false
            )
        }

        let resetTime = extractResetTimeFromHTML(html) ?? Date().addingTimeInterval(3600)

        return UsageData(
            tokensUsed: tUsed,
            tokensLimit: tLimit,
            messagesUsed: mUsed,
            messagesLimit: mLimit,
            resetTime: resetTime,
            lastUpdated: Date()
        )
    }

    /// Extracts a number from a string using a regex pattern.
    private func extractNumber(from string: String, pattern: String) -> Int? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return nil
        }
        let range = NSRange(string.startIndex..., in: string)
        guard let match = regex.firstMatch(in: string, range: range),
              match.numberOfRanges > 1 else {
            return nil
        }
        let captureRange = match.range(at: 1)
        guard let swiftRange = Range(captureRange, in: string) else {
            return nil
        }
        return Int(string[swiftRange])
    }

    /// Parses a reset time from JSON dictionary.
    private func parseResetTime(from json: [String: Any]) -> Date {
        if let resetTimeString = json["resetTime"] as? String ?? json["reset_time"] as? String {
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: resetTimeString) {
                return date
            }
        }
        if let resetTimeInterval = json["resetTime"] as? TimeInterval ?? json["reset_time"] as? TimeInterval {
            return Date(timeIntervalSince1970: resetTimeInterval)
        }
        // Default to 1 hour from now if not specified
        return Date().addingTimeInterval(3600)
    }

    /// Extracts reset time from HTML content.
    private func extractResetTimeFromHTML(_ html: String) -> Date? {
        // Try ISO 8601 date pattern
        let isoPattern = "reset[_\\s-]?time[\"':=\\s]+([\\dT:.Z+-]+)"
        if let regex = try? NSRegularExpression(pattern: isoPattern, options: .caseInsensitive) {
            let range = NSRange(html.startIndex..., in: html)
            if let match = regex.firstMatch(in: html, range: range),
               match.numberOfRanges > 1,
               let captureRange = Range(match.range(at: 1), in: html) {
                let dateStr = String(html[captureRange])
                let formatter = ISO8601DateFormatter()
                if let date = formatter.date(from: dateStr) {
                    return date
                }
            }
        }
        return nil
    }
}
