import Foundation

/// Represents a manual override configuration for usage data.
/// When enabled, override percentages take precedence over fetched API values.
struct ManualOverride: Codable, Equatable {
    /// Whether the manual override is currently active
    var enabled: Bool

    /// Optional override percentage for input token usage (0-100)
    var inputPercentage: Double?

    /// Optional override percentage for output token usage (0-100)
    var outputPercentage: Double?

    /// Optional override for the reset time
    var resetTime: Date?

    /// Timestamp when this override was created or last modified
    var createdAt: Date

    /// Creates a new ManualOverride instance
    init(
        enabled: Bool = false,
        inputPercentage: Double? = nil,
        outputPercentage: Double? = nil,
        resetTime: Date? = nil,
        createdAt: Date = Date()
    ) {
        self.enabled = enabled
        self.inputPercentage = inputPercentage
        self.outputPercentage = outputPercentage
        self.resetTime = resetTime
        self.createdAt = createdAt
    }

    /// Returns a disabled override with no values set
    static var disabled: ManualOverride {
        ManualOverride(enabled: false)
    }
}
