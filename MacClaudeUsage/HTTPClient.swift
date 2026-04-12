import Foundation

/// Configuration for HTTP client behavior.
enum HTTPClientConstants {
    /// Request timeout in seconds.
    static let requestTimeout: TimeInterval = 30

    /// Maximum number of retry attempts for transient failures.
    static let maxRetries = 3

    /// Base delay between retries in seconds (exponential backoff).
    static let retryBaseDelay: TimeInterval = 1.0

    /// Rate limit: minimum interval between requests in seconds.
    static let minRequestInterval: TimeInterval = 2.0

    /// Claude.ai base URL.
    static let baseURL = "https://claude.ai"

    /// Usage API endpoint path.
    static let usageEndpointPath = "/api/usage"

    /// User-Agent header value.
    static let userAgent = "MacClaudeUsage/1.0"
}

/// Response from an HTTP request.
struct HTTPResponse {
    let data: Data
    let statusCode: Int
    let contentType: String?
    let headers: [String: String]
}

/// Handles authenticated HTTP requests to Claude.ai with retry logic and rate limiting.
class HTTPClient {
    private let session: URLSession
    private var lastRequestTime: Date?

    init(session: URLSession? = nil) {
        if let session = session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = HTTPClientConstants.requestTimeout
            config.timeoutIntervalForResource = HTTPClientConstants.requestTimeout * 2
            config.httpShouldSetCookies = true
            config.httpCookieAcceptPolicy = .always
            self.session = URLSession(configuration: config)
        }
    }

    // MARK: - Authenticated Request

    /// Makes an authenticated request to the specified URL using the provided credentials.
    /// Implements retry logic with exponential backoff for transient failures.
    func makeAuthenticatedRequest(
        url: URL,
        credentials: AuthCredentials,
        method: String = "GET"
    ) throws -> HTTPResponse {
        // Validate credentials before making the request
        let keychainManager = KeychainManager.shared
        let authState = keychainManager.validateCredentials(credentials)

        guard authState == .authenticated else {
            throw FetchError(
                message: "Credentials are \(authState.rawValue), authentication required",
                code: FetchErrorCode.credentialsExpired,
                retryable: false
            )
        }

        // Respect rate limiting
        enforceRateLimit()

        var lastError: FetchError?

        for attempt in 0..<HTTPClientConstants.maxRetries {
            do {
                let response = try executeRequest(url: url, credentials: credentials, method: method)
                lastRequestTime = Date()
                return response
            } catch let error as FetchError {
                lastError = error
                if !error.retryable || attempt == HTTPClientConstants.maxRetries - 1 {
                    throw error
                }
                let delay = HTTPClientConstants.retryBaseDelay * pow(2.0, Double(attempt))
                NSLog("[MacClaudeUsage] Request attempt %d failed (%@), retrying in %.1fs", attempt + 1, error.code, delay)
                Thread.sleep(forTimeInterval: delay)
            }
        }

        throw lastError ?? FetchError(
            message: "Request failed after \(HTTPClientConstants.maxRetries) attempts",
            code: FetchErrorCode.networkError,
            retryable: false
        )
    }

    // MARK: - Fetch Usage Data

    /// Convenience method to fetch usage data from the Claude.ai API.
    func fetchUsageData(credentials: AuthCredentials) throws -> HTTPResponse {
        guard let url = URL(string: HTTPClientConstants.baseURL + HTTPClientConstants.usageEndpointPath) else {
            throw FetchError(
                message: "Invalid usage endpoint URL",
                code: FetchErrorCode.networkError,
                retryable: false
            )
        }

        return try makeAuthenticatedRequest(url: url, credentials: credentials)
    }

    // MARK: - Private Helpers

    /// Executes a single HTTP request synchronously.
    private func executeRequest(
        url: URL,
        credentials: AuthCredentials,
        method: String
    ) throws -> HTTPResponse {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(HTTPClientConstants.userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue("text/html,application/json", forHTTPHeaderField: "Accept")

        // Set authentication headers
        if let sessionToken = credentials.sessionToken {
            request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        }
        if let cookies = credentials.cookies {
            request.setValue(cookies, forHTTPHeaderField: "Cookie")
        }

        var responseData: Data?
        var httpResponse: HTTPURLResponse?
        var requestError: Error?

        let semaphore = DispatchSemaphore(value: 0)

        let task = session.dataTask(with: request) { data, response, error in
            responseData = data
            httpResponse = response as? HTTPURLResponse
            requestError = error
            semaphore.signal()
        }
        task.resume()

        let timeout = DispatchTime.now() + HTTPClientConstants.requestTimeout
        if semaphore.wait(timeout: timeout) == .timedOut {
            task.cancel()
            throw FetchError(
                message: "Request timed out after \(Int(HTTPClientConstants.requestTimeout))s",
                code: FetchErrorCode.networkTimeout,
                retryable: true
            )
        }

        if let error = requestError {
            let nsError = error as NSError
            let isTransient = nsError.domain == NSURLErrorDomain &&
                [NSURLErrorTimedOut, NSURLErrorNetworkConnectionLost, NSURLErrorNotConnectedToInternet]
                    .contains(nsError.code)
            throw FetchError(
                message: "Network error: \(error.localizedDescription)",
                code: FetchErrorCode.networkError,
                retryable: isTransient
            )
        }

        guard let response = httpResponse, let data = responseData else {
            throw FetchError(
                message: "No response received from server",
                code: FetchErrorCode.networkError,
                retryable: true
            )
        }

        // Handle HTTP status codes
        switch response.statusCode {
        case 200...299:
            let contentType = response.value(forHTTPHeaderField: "Content-Type")
            let headers = Dictionary(
                uniqueKeysWithValues: response.allHeaderFields.compactMap { key, value in
                    guard let key = key as? String, let value = value as? String else { return nil }
                    return (key, value)
                }
            )
            return HTTPResponse(
                data: data,
                statusCode: response.statusCode,
                contentType: contentType,
                headers: headers
            )
        case 401, 403:
            throw FetchError(
                message: "Authentication failed (HTTP \(response.statusCode))",
                code: FetchErrorCode.authenticationFailed,
                retryable: false
            )
        case 429:
            throw FetchError(
                message: "Rate limited by Claude.ai (HTTP 429)",
                code: FetchErrorCode.rateLimited,
                retryable: true
            )
        case 500...599:
            throw FetchError(
                message: "Server error (HTTP \(response.statusCode))",
                code: FetchErrorCode.serverError,
                retryable: true
            )
        default:
            throw FetchError(
                message: "Unexpected HTTP status: \(response.statusCode)",
                code: FetchErrorCode.invalidResponse,
                retryable: false
            )
        }
    }

    /// Enforces rate limiting between requests.
    private func enforceRateLimit() {
        guard let lastRequest = lastRequestTime else { return }
        let elapsed = Date().timeIntervalSince(lastRequest)
        if elapsed < HTTPClientConstants.minRequestInterval {
            let waitTime = HTTPClientConstants.minRequestInterval - elapsed
            Thread.sleep(forTimeInterval: waitTime)
        }
    }
}
