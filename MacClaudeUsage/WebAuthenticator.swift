import Foundation
import WebKit

/// Result of an authentication attempt via the web view flow.
struct AuthResult {
    let state: AuthState
    var credentials: AuthCredentials?
    var error: String?
}

/// Manages the WKWebView-based authentication flow for Claude.ai login.
/// Presents a web view, monitors navigation for successful login, extracts
/// session credentials, and stores them securely via KeychainManager.
class WebAuthenticator: NSObject {
    static let shared = WebAuthenticator()

    private let keychainManager: KeychainManager
    private let claudeBaseURL = "https://claude.ai"
    private let loginPath = "/login"
    private let dashboardPath = "/chat"

    private var authCompletion: ((AuthResult) -> Void)?
    private var authWindow: AuthenticationWindow?
    private var webAuthDelegate: WebAuthDelegate?

    init(keychainManager: KeychainManager = KeychainManager.shared) {
        self.keychainManager = keychainManager
        super.init()
    }

    // MARK: - Public API

    /// Initiates the authentication flow by presenting a WKWebView pointed at Claude.ai login.
    /// Returns an AuthResult upon completion, whether successful or failed.
    func authenticateWithWebView(completion: @escaping (AuthResult) -> Void) {
        NSLog("[MacClaudeUsage] Starting WKWebView authentication flow")

        authCompletion = completion

        let configuration = createWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: configuration)

        webAuthDelegate = WebAuthDelegate(
            onAuthenticationSuccess: { [weak self] webView in
                self?.handleAuthenticationSuccess(webView: webView)
            },
            onAuthenticationFailure: { [weak self] error in
                self?.handleAuthenticationFailure(error: error)
            },
            claudeBaseURL: claudeBaseURL,
            dashboardPath: dashboardPath
        )

        webView.navigationDelegate = webAuthDelegate

        authWindow = AuthenticationWindow(webView: webView)
        authWindow?.onWindowClose = { [weak self] in
            self?.handleWindowClosed()
        }

        guard let loginURL = URL(string: "\(claudeBaseURL)\(loginPath)") else {
            let result = AuthResult(
                state: .unauthenticated,
                credentials: nil,
                error: "Invalid login URL"
            )
            completion(result)
            return
        }

        let request = URLRequest(url: loginURL)
        webView.load(request)
        authWindow?.showWindow()

        NSLog("[MacClaudeUsage] Authentication window presented, loading login page")
    }

    // MARK: - Credential Extraction

    /// Extracts session credentials from the web view's cookie store after successful login.
    /// Throws AuthError if no valid session cookies are found.
    func extractCredentials(from webView: WKWebView, completion: @escaping (Result<AuthCredentials, AuthError>) -> Void) {
        let cookieStore = webView.configuration.websiteDataStore.httpCookieStore

        cookieStore.getAllCookies { [weak self] cookies in
            guard let self = self else { return }

            let claudeCookies = cookies.filter { cookie in
                cookie.domain.contains("claude.ai")
            }

            guard !claudeCookies.isEmpty else {
                let error = AuthError(
                    message: "No valid session cookies found after authentication",
                    code: "NO_SESSION_COOKIES",
                    requiresReauth: true
                )
                completion(.failure(error))
                return
            }

            let sessionToken = self.extractSessionToken(from: claudeCookies)
            let cookieString = self.serializeCookies(claudeCookies)

            let credentials = AuthCredentials(
                sessionToken: sessionToken,
                cookies: cookieString,
                lastAuthTime: Date()
            )

            completion(.success(credentials))
        }
    }

    /// Validates whether authentication was successful by checking the current URL
    /// and presence of valid cookies.
    func validateAuthenticationSuccess(url: URL?, cookies: [HTTPCookie]) -> Bool {
        guard let url = url,
              url.absoluteString.contains("claude.ai") else {
            return false
        }

        let hasSessionCookies = cookies.contains { cookie in
            cookie.domain.contains("claude.ai") && !cookie.value.isEmpty
        }

        return hasSessionCookies
    }

    // MARK: - Private Helpers

    /// Creates a WKWebView configuration with JavaScript enabled and a non-persistent data store
    /// for privacy during the authentication flow.
    private func createWebViewConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = preferences
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        return configuration
    }

    /// Extracts the session token from Claude.ai cookies.
    private func extractSessionToken(from cookies: [HTTPCookie]) -> String? {
        let sessionCookieNames = ["sessionKey", "sk-ant-sid", "__cf_bm", "activityToken"]
        for name in sessionCookieNames {
            if let cookie = cookies.first(where: { $0.name == name }) {
                return cookie.value
            }
        }
        // Fallback: return the first non-empty cookie value
        return cookies.first(where: { !$0.value.isEmpty })?.value
    }

    /// Serializes cookies into a single string for storage.
    private func serializeCookies(_ cookies: [HTTPCookie]) -> String {
        return cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
    }

    /// Handles a successful authentication detected by the navigation delegate.
    private func handleAuthenticationSuccess(webView: WKWebView) {
        NSLog("[MacClaudeUsage] Authentication success detected, extracting credentials")

        extractCredentials(from: webView) { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let credentials):
                do {
                    try self.keychainManager.storeCredentials(credentials)
                    NSLog("[MacClaudeUsage] Credentials extracted and stored successfully")

                    let authResult = AuthResult(
                        state: .authenticated,
                        credentials: credentials,
                        error: nil
                    )
                    self.completeAuthentication(result: authResult)
                } catch {
                    NSLog("[MacClaudeUsage] Failed to store credentials in keychain")
                    let authResult = AuthResult(
                        state: .unauthenticated,
                        credentials: nil,
                        error: "Failed to store credentials: \(error.localizedDescription)"
                    )
                    self.completeAuthentication(result: authResult)
                }

            case .failure(let error):
                NSLog("[MacClaudeUsage] Failed to extract credentials: \(error.message)")
                let authResult = AuthResult(
                    state: .unauthenticated,
                    credentials: nil,
                    error: error.message
                )
                self.completeAuthentication(result: authResult)
            }
        }
    }

    /// Handles authentication failure reported by the navigation delegate.
    private func handleAuthenticationFailure(error: String) {
        NSLog("[MacClaudeUsage] Authentication failed: \(error)")
        let authResult = AuthResult(
            state: .unauthenticated,
            credentials: nil,
            error: error
        )
        completeAuthentication(result: authResult)
    }

    /// Handles the user closing the authentication window before completing login.
    private func handleWindowClosed() {
        NSLog("[MacClaudeUsage] Authentication window closed by user")
        let authResult = AuthResult(
            state: .unauthenticated,
            credentials: nil,
            error: "Authentication cancelled by user"
        )
        completeAuthentication(result: authResult)
    }

    /// Completes the authentication flow: closes the window and invokes the callback.
    private func completeAuthentication(result: AuthResult) {
        DispatchQueue.main.async { [weak self] in
            self?.authWindow?.closeWindow()
            self?.authWindow = nil
            self?.webAuthDelegate = nil
            self?.authCompletion?(result)
            self?.authCompletion = nil
        }
    }
}
