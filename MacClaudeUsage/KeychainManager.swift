import Foundation
import Security

/// Represents authentication credentials stored in the keychain.
struct AuthCredentials {
    var sessionToken: String?
    var cookies: String?
    var lastAuthTime: Date
}

/// Represents the current authentication state.
enum AuthState: String {
    case authenticated
    case unauthenticated
    case expired
    case invalid
}

/// Error type for authentication and keychain operations.
class AuthError: Error {
    let code: String
    let message: String
    let requiresReauth: Bool

    init(message: String, code: String, requiresReauth: Bool = false) {
        self.message = message
        self.code = code
        self.requiresReauth = requiresReauth
    }

    var localizedDescription: String {
        return "\(message) (code: \(code))"
    }
}

/// Manages secure storage and retrieval of authentication credentials using macOS Keychain Services.
class KeychainManager {
    static let shared = KeychainManager()

    private let serviceName: String

    init(serviceName: String = KeychainConstants.serviceName) {
        self.serviceName = serviceName
    }

    // MARK: - Store Credentials

    /// Stores authentication credentials securely in the keychain.
    /// Replaces any existing credentials for the same service.
    func storeCredentials(_ credentials: AuthCredentials) throws {
        // Store session token if present
        if let sessionToken = credentials.sessionToken {
            try storeItem(
                account: KeychainConstants.Account.sessionToken,
                data: sessionToken
            )
        }

        // Store cookies if present
        if let cookies = credentials.cookies {
            try storeItem(
                account: KeychainConstants.Account.cookies,
                data: cookies
            )
        }

        // Store last auth time as ISO 8601 string
        let formatter = ISO8601DateFormatter()
        let dateString = formatter.string(from: credentials.lastAuthTime)
        try storeItem(
            account: KeychainConstants.Account.lastAuthTime,
            data: dateString
        )

        NSLog("[MacClaudeUsage] Credentials stored successfully in keychain")
    }

    // MARK: - Retrieve Credentials

    /// Retrieves authentication credentials from the keychain.
    /// Throws AuthError if access is denied or credentials are not found.
    func retrieveCredentials() throws -> AuthCredentials {
        let lastAuthTimeString = try retrieveItem(
            account: KeychainConstants.Account.lastAuthTime
        )

        let formatter = ISO8601DateFormatter()
        guard let lastAuthTime = formatter.date(from: lastAuthTimeString) else {
            throw AuthError(
                message: "Invalid date format in stored credentials",
                code: KeychainConstants.ErrorCode.keychainDataInvalid,
                requiresReauth: true
            )
        }

        let sessionToken = try? retrieveItem(
            account: KeychainConstants.Account.sessionToken
        )

        let cookies = try? retrieveItem(
            account: KeychainConstants.Account.cookies
        )

        return AuthCredentials(
            sessionToken: sessionToken,
            cookies: cookies,
            lastAuthTime: lastAuthTime
        )
    }

    // MARK: - Validate Credentials

    /// Validates credentials and returns the current authentication state.
    /// Credentials older than 24 hours are considered expired.
    func validateCredentials(_ credentials: AuthCredentials) -> AuthState {
        // Check if we have at least a session token or cookies
        guard credentials.sessionToken != nil || credentials.cookies != nil else {
            return .invalid
        }

        // Check if credentials are expired (older than 24 hours)
        let elapsed = Date().timeIntervalSince(credentials.lastAuthTime)
        if elapsed > KeychainConstants.credentialExpirationInterval {
            return .expired
        }

        return .authenticated
    }

    // MARK: - Delete Credentials

    /// Removes all stored credentials from the keychain.
    func deleteCredentials() throws {
        let accounts = [
            KeychainConstants.Account.sessionToken,
            KeychainConstants.Account.cookies,
            KeychainConstants.Account.lastAuthTime,
        ]

        for account in accounts {
            try? deleteItem(account: account)
        }

        NSLog("[MacClaudeUsage] Credentials deleted from keychain")
    }

    // MARK: - Private Helpers

    /// Stores a single string item in the keychain, replacing any existing item with the same account.
    private func storeItem(account: String, data: String) throws {
        guard let dataBytes = data.data(using: .utf8) else {
            throw AuthError(
                message: "Failed to encode data for keychain storage",
                code: KeychainConstants.ErrorCode.keychainStoreFailed
            )
        }

        // First try to delete any existing item to prevent duplicates
        deleteItemSilently(account: account)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account,
            kSecValueData as String: dataBytes,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        switch status {
        case errSecSuccess:
            return
        case errSecAuthFailed, errSecInteractionNotAllowed:
            throw AuthError(
                message: "Keychain access denied. Please check app permissions.",
                code: KeychainConstants.ErrorCode.keychainAccessDenied,
                requiresReauth: true
            )
        case errSecDuplicateItem:
            throw AuthError(
                message: "Duplicate keychain item for account: \(account)",
                code: KeychainConstants.ErrorCode.keychainDuplicateItem
            )
        default:
            throw AuthError(
                message: "Failed to store item in keychain (OSStatus: \(status))",
                code: KeychainConstants.ErrorCode.keychainStoreFailed
            )
        }
    }

    /// Retrieves a single string item from the keychain.
    private func retrieveItem(account: String) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            guard let data = result as? Data,
                  let string = String(data: data, encoding: .utf8) else {
                throw AuthError(
                    message: "Failed to decode keychain data for account: \(account)",
                    code: KeychainConstants.ErrorCode.keychainDataInvalid,
                    requiresReauth: true
                )
            }
            return string
        case errSecItemNotFound:
            throw AuthError(
                message: "No keychain item found for account: \(account)",
                code: KeychainConstants.ErrorCode.keychainItemNotFound,
                requiresReauth: true
            )
        case errSecAuthFailed, errSecInteractionNotAllowed:
            throw AuthError(
                message: "Keychain access denied. Please check app permissions.",
                code: KeychainConstants.ErrorCode.keychainAccessDenied,
                requiresReauth: true
            )
        default:
            throw AuthError(
                message: "Failed to retrieve item from keychain (OSStatus: \(status))",
                code: KeychainConstants.ErrorCode.keychainAccessDenied,
                requiresReauth: true
            )
        }
    }

    /// Deletes a single item from the keychain.
    private func deleteItem(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account,
        ]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw AuthError(
                message: "Failed to delete keychain item for account: \(account) (OSStatus: \(status))",
                code: KeychainConstants.ErrorCode.keychainDeleteFailed
            )
        }
    }

    /// Silently deletes an item without throwing errors.
    private func deleteItemSilently(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
