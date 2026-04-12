import Cocoa
import WebKit

/// Manages the NSWindow that hosts the WKWebView for the Claude.ai authentication flow.
/// Provides a focused, appropriately sized window with a title bar and close behavior
/// that notifies the authenticator when the user dismisses the window.
class AuthenticationWindow: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    private let webView: WKWebView

    /// Called when the user closes the authentication window without completing login.
    var onWindowClose: (() -> Void)?

    private let windowWidth: CGFloat = 480
    private let windowHeight: CGFloat = 680

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
    }

    // MARK: - Window Management

    /// Creates and displays the authentication window centered on screen.
    func showWindow() {
        let contentRect = NSRect(x: 0, y: 0, width: windowWidth, height: windowHeight)

        let styleMask: NSWindow.StyleMask = [.titled, .closable, .resizable]

        let window = NSWindow(
            contentRect: contentRect,
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )

        window.title = "Sign in to Claude"
        window.delegate = self
        window.contentView = webView
        window.center()
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 400, height: 500)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        self.window = window

        NSLog("[MacClaudeUsage] Authentication window displayed")
    }

    /// Closes the authentication window programmatically (e.g., after successful login).
    func closeWindow() {
        DispatchQueue.main.async { [weak self] in
            self?.window?.close()
            self?.window = nil
            NSLog("[MacClaudeUsage] Authentication window closed")
        }
    }

    // MARK: - NSWindowDelegate

    /// Detects when the user closes the window manually via the close button.
    func windowWillClose(_ notification: Notification) {
        onWindowClose?()
        onWindowClose = nil
        window = nil
    }
}
