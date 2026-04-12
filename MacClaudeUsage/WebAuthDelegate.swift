import Foundation
import WebKit

/// WKNavigationDelegate that monitors the authentication flow in the WKWebView.
/// Detects successful login by observing URL changes and cookie updates,
/// and reports authentication failures for network errors or navigation issues.
class WebAuthDelegate: NSObject, WKNavigationDelegate {
    private let onAuthenticationSuccess: (WKWebView) -> Void
    private let onAuthenticationFailure: (String) -> Void
    private let claudeBaseURL: String
    private let dashboardPath: String

    private var hasReportedResult = false

    init(
        onAuthenticationSuccess: @escaping (WKWebView) -> Void,
        onAuthenticationFailure: @escaping (String) -> Void,
        claudeBaseURL: String,
        dashboardPath: String
    ) {
        self.onAuthenticationSuccess = onAuthenticationSuccess
        self.onAuthenticationFailure = onAuthenticationFailure
        self.claudeBaseURL = claudeBaseURL
        self.dashboardPath = dashboardPath
        super.init()
    }

    // MARK: - WKNavigationDelegate

    /// Called when navigation completes. Checks if the user has landed on the
    /// Claude.ai dashboard, indicating a successful login.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !hasReportedResult else { return }

        guard let url = webView.url else { return }

        NSLog("[MacClaudeUsage] Navigation finished: \(url.absoluteString)")

        if isAuthenticatedURL(url) {
            NSLog("[MacClaudeUsage] Detected authenticated URL, verifying cookies")
            verifyCookiesAndReport(webView: webView, url: url)
        }
    }

    /// Called when navigation fails. Reports the error unless a result has already been sent.
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard !hasReportedResult else { return }

        NSLog("[MacClaudeUsage] Navigation failed: \(error.localizedDescription)")
        reportFailure(error: "Navigation failed: \(error.localizedDescription)")
    }

    /// Called when the web view fails to start loading a page.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard !hasReportedResult else { return }

        NSLog("[MacClaudeUsage] Provisional navigation failed: \(error.localizedDescription)")
        reportFailure(error: "Failed to load page: \(error.localizedDescription)")
    }

    /// Handles authentication challenges, including server trust for HTTPS connections.
    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }

    /// Decides navigation policy. Allows all navigations within the claude.ai domain
    /// and blocks navigations to unrelated external sites.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // Allow all claude.ai navigations and common auth provider domains
        let allowedDomains = ["claude.ai", "anthropic.com", "accounts.google.com", "github.com", "login.microsoftonline.com"]
        let isAllowed = allowedDomains.contains { domain in
            url.host?.contains(domain) == true
        }

        if isAllowed {
            decisionHandler(.allow)
        } else {
            NSLog("[MacClaudeUsage] Blocked navigation to external domain: \(url.host ?? "unknown")")
            decisionHandler(.cancel)
        }
    }

    // MARK: - Private Helpers

    /// Checks whether the given URL indicates a successful authentication (user on dashboard).
    private func isAuthenticatedURL(_ url: URL) -> Bool {
        let urlString = url.absoluteString
        return urlString.contains(claudeBaseURL) &&
            (urlString.contains(dashboardPath) || urlString.hasSuffix("claude.ai") || urlString.hasSuffix("claude.ai/"))
    }

    /// Verifies that valid cookies exist before reporting authentication success.
    private func verifyCookiesAndReport(webView: WKWebView, url: URL) {
        let cookieStore = webView.configuration.websiteDataStore.httpCookieStore

        cookieStore.getAllCookies { [weak self] cookies in
            guard let self = self, !self.hasReportedResult else { return }

            let claudeCookies = cookies.filter { $0.domain.contains("claude.ai") }

            if !claudeCookies.isEmpty {
                self.reportSuccess(webView: webView)
            } else {
                NSLog("[MacClaudeUsage] Authenticated URL reached but no cookies found yet, waiting...")
            }
        }
    }

    /// Reports successful authentication exactly once.
    private func reportSuccess(webView: WKWebView) {
        guard !hasReportedResult else { return }
        hasReportedResult = true
        NSLog("[MacClaudeUsage] Authentication success reported")
        onAuthenticationSuccess(webView)
    }

    /// Reports authentication failure exactly once.
    private func reportFailure(error: String) {
        guard !hasReportedResult else { return }
        hasReportedResult = true
        onAuthenticationFailure(error)
    }
}
