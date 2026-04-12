import SwiftUI

/// Helper for computing layout-specific progress bar configurations
/// used by the widget views for small and medium sizes.
struct WidgetLayoutHelper {

    /// Creates a ProgressBarConfig for input token usage.
    /// Calculates percentage from usage.inputTokens / usage.inputLimit.
    static func inputProgressConfig(
        usage: UsageData,
        config: ProgressBarConfig
    ) -> ProgressBarConfig {
        let effective = usage.getEffectiveUsage()
        let percentage: Double
        if effective.inputLimit > 0 {
            percentage = min(max((Double(effective.inputTokens) / Double(effective.inputLimit)) * 100.0, 0), 100)
        } else {
            percentage = 0
        }
        return ProgressBarConfig(
            value: percentage,
            threshold1: config.threshold1,
            threshold2: config.threshold2,
            colors: config.colors
        )
    }

    /// Creates a ProgressBarConfig for output token usage.
    /// Calculates percentage from usage.outputTokens / usage.outputLimit.
    static func outputProgressConfig(
        usage: UsageData,
        config: ProgressBarConfig
    ) -> ProgressBarConfig {
        let effective = usage.getEffectiveUsage()
        let percentage: Double
        if effective.outputLimit > 0 {
            percentage = min(max((Double(effective.outputTokens) / Double(effective.outputLimit)) * 100.0, 0), 100)
        } else {
            percentage = 0
        }
        return ProgressBarConfig(
            value: percentage,
            threshold1: config.threshold1,
            threshold2: config.threshold2,
            colors: config.colors
        )
    }

    /// Returns the combined usage percentage across input and output tokens.
    static func combinedPercentage(usage: UsageData) -> Double {
        let effective = usage.getEffectiveUsage()
        let totalUsed = effective.inputTokens + effective.outputTokens
        let totalLimit = effective.inputLimit + effective.outputLimit
        guard totalLimit > 0 else { return 0 }
        return min(max((Double(totalUsed) / Double(totalLimit)) * 100.0, 0), 100)
    }
}
