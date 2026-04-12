import Foundation

struct ManualOverride: Codable, Equatable {
    var enabled: Bool
    var inputPercentage: Double?
    var outputPercentage: Double?
    var resetTime: Date?

    static let disabled = ManualOverride(enabled: false)
}
