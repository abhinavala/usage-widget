import Foundation

/// Shared usage data model used across widget, Mac app, and iOS app.
/// Supports manual override functionality where user-set percentages
/// take precedence over API-fetched values.
struct UsageData: Codable, Equatable {
    /// Number of input tokens used
    var inputTokens: Int

    /// Number of output tokens used
    var outputTokens: Int

    /// Maximum input token limit
    var inputLimit: Int

    /// Maximum output token limit
    var outputLimit: Int

    /// When the usage counters reset
    var resetTime: Date

    /// When this data was last fetched from the API
    var lastUpdated: Date

    /// Optional manual override configuration
    var manualOverride: ManualOverride?

    /// Creates a new UsageData instance
    init(
        inputTokens: Int,
        outputTokens: Int,
        inputLimit: Int,
        outputLimit: Int,
        resetTime: Date,
        lastUpdated: Date,
        manualOverride: ManualOverride? = nil
    ) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.inputLimit = inputLimit
        self.outputLimit = outputLimit
        self.resetTime = resetTime
        self.lastUpdated = lastUpdated
        self.manualOverride = manualOverride
    }

    /// Returns whether manual overrides are currently being applied
    func isUsingOverrides() -> Bool {
        guard let override = manualOverride else { return false }
        return override.enabled
    }

    /// Returns the effective usage data, applying manual overrides if active.
    /// When overrides are enabled, override percentages are used to calculate
    /// token counts based on the limits. Original fetched data is preserved
    /// in the base properties.
    func getEffectiveUsage() -> UsageData {
        guard let override = manualOverride, override.enabled else {
            return self
        }

        var effective = self

        if let inputPercentage = override.inputPercentage {
            effective.inputTokens = Int(Double(inputLimit) * inputPercentage / 100.0)
        }

        if let outputPercentage = override.outputPercentage {
            effective.outputTokens = Int(Double(outputLimit) * outputPercentage / 100.0)
        }

        if let overrideResetTime = override.resetTime {
            effective.resetTime = overrideResetTime
        }

        return effective
    }

    /// Applies a manual override while preserving the original fetched data.
    /// Returns a new UsageData instance with the override attached.
    func applyManualOverride(_ override: ManualOverride) -> UsageData {
        var updated = self
        updated.manualOverride = override
        return updated
    }
}
