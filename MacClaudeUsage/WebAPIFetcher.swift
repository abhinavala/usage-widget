import Foundation

/// Protocol for fetching Claude usage data from different sources.
protocol UsageFetcher {
    func fetchUsage() throws -> UsageData
}

/// Primary data fetcher that retrieves Claude usage data via authenticated web API requests.
/// Uses stored keychain credentials to authenticate against claude.ai and parses the response
/// into a standardized UsageData structure.
class WebAPIFetcher: UsageFetcher {
    static let shared = WebAPIFetcher()

    private let keychainManager: KeychainManager
    private let httpClient: HTTPClient
    private let responseParser: ResponseParser
    private let fetcherType: FetcherType = .webapi

    init(
        keychainManager: KeychainManager = .shared,
        httpClient: HTTPClient = HTTPClient(),
        responseParser: ResponseParser = ResponseParser()
    ) {
        self.keychainManager = keychainManager
        self.httpClient = httpClient
        self.responseParser = responseParser
    }

    // MARK: - UsageFetcher Protocol

    /// Fetches current Claude usage data using stored authentication credentials.
    /// Retrieves credentials from keychain, makes an authenticated API request,
    /// and parses the response into UsageData.
    func fetchUsage() throws -> UsageData {
        NSLog("[MacClaudeUsage] WebAPIFetcher: Starting usage data fetch")

        // Step 1: Retrieve credentials from keychain
        let credentials: AuthCredentials
        do {
            credentials = try keychainManager.retrieveCredentials()
        } catch {
            NSLog("[MacClaudeUsage] WebAPIFetcher: Failed to retrieve credentials")
            throw FetchError(
                message: "Failed to retrieve authentication credentials: \(error.localizedDescription)",
                code: FetchErrorCode.credentialsExpired,
                fetcherType: fetcherType,
                retryable: false
            )
        }

        // Step 2: Validate credentials
        let authState = keychainManager.validateCredentials(credentials)
        guard authState == .authenticated else {
            NSLog("[MacClaudeUsage] WebAPIFetcher: Credentials are %@", authState.rawValue)
            throw FetchError(
                message: "Authentication credentials are \(authState.rawValue)",
                code: FetchErrorCode.credentialsExpired,
                fetcherType: fetcherType,
                retryable: false
            )
        }

        // Step 3: Make authenticated request
        let response: HTTPResponse
        do {
            response = try httpClient.fetchUsageData(credentials: credentials)
        } catch let error as FetchError {
            NSLog("[MacClaudeUsage] WebAPIFetcher: HTTP request failed - %@", error.code)
            throw error
        } catch {
            NSLog("[MacClaudeUsage] WebAPIFetcher: Unexpected error during fetch")
            throw FetchError(
                message: "Unexpected error during fetch: \(error.localizedDescription)",
                code: FetchErrorCode.networkError,
                fetcherType: fetcherType,
                retryable: true
            )
        }

        // Step 4: Parse response
        let usageData: UsageData
        do {
            usageData = try responseParser.parseResponse(response.data, contentType: response.contentType)
        } catch let error as FetchError {
            NSLog("[MacClaudeUsage] WebAPIFetcher: Failed to parse response - %@", error.code)
            throw error
        } catch {
            NSLog("[MacClaudeUsage] WebAPIFetcher: Unexpected parse error")
            throw FetchError(
                message: "Failed to parse usage response: \(error.localizedDescription)",
                code: FetchErrorCode.parseError,
                fetcherType: fetcherType,
                retryable: false
            )
        }

        NSLog("[MacClaudeUsage] WebAPIFetcher: Successfully fetched usage data (tokens: %d/%d, messages: %d/%d)",
              usageData.tokensUsed, usageData.tokensLimit,
              usageData.messagesUsed, usageData.messagesLimit)

        return usageData
    }

    // MARK: - Authenticated Request (exposed for testing)

    /// Makes an authenticated request using the provided credentials.
    /// Validates credential state and delegates to HTTPClient.
    func makeAuthenticatedRequest(url: URL, credentials: AuthCredentials) throws -> HTTPResponse {
        let authState = keychainManager.validateCredentials(credentials)
        guard authState == .authenticated else {
            throw FetchError(
                message: "Credentials are \(authState.rawValue), re-authentication required",
                code: FetchErrorCode.credentialsExpired,
                fetcherType: fetcherType,
                retryable: false
            )
        }

        return try httpClient.makeAuthenticatedRequest(url: url, credentials: credentials)
    }
}
