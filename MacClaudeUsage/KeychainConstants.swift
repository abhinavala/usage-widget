import Foundation

/// Constants for keychain operations used by the KeychainManager.
enum KeychainConstants {
    /// The keychain service identifier for MacClaudeUsage credentials.
    static let serviceName = "com.claudeusage.mac"

    /// Account keys for different credential types stored in the keychain.
    enum Account {
        static let sessionToken = "sessionToken"
        static let cookies = "cookies"
        static let lastAuthTime = "lastAuthTime"
    }

    /// Access group for shared keychain access (if needed across targets).
    static let accessGroup: String? = nil

    /// Credential expiration threshold in seconds (24 hours).
    static let credentialExpirationInterval: TimeInterval = 24 * 60 * 60

    /// Error codes for keychain operations.
    enum ErrorCode {
        static let keychainAccessDenied = "KEYCHAIN_ACCESS_DENIED"
        static let keychainItemNotFound = "KEYCHAIN_ITEM_NOT_FOUND"
        static let keychainDuplicateItem = "KEYCHAIN_DUPLICATE_ITEM"
        static let keychainStoreFailed = "KEYCHAIN_STORE_FAILED"
        static let keychainDeleteFailed = "KEYCHAIN_DELETE_FAILED"
        static let keychainDataInvalid = "KEYCHAIN_DATA_INVALID"
    }
}
