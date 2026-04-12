import Foundation

/// Errors that can occur when validating manual override values.
enum OverrideValidationError: Error, Equatable {
    case percentageOutOfRange(String)
    case invalidResetTime(String)

    var message: String {
        switch self {
        case .percentageOutOfRange(let detail):
            return detail
        case .invalidResetTime(let detail):
            return detail
        }
    }
}
