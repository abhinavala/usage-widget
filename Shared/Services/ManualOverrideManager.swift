import Foundation

/// Represents the source of usage data.
enum FetchSource: String, Codable, Equatable {
    case webapi
    case cli
    case manual
    case cache
}

/// Result of calculating effective usage, including data provenance.
struct EffectiveUsageResult: Equatable {
    let usageData: UsageData
    let source: FetchSource
}

/// Manages manual override business logic including precedence rules,
/// validation, expiration, and conflict resolution between override
/// and fetched data sources.
class ManualOverrideManager {

    /// Default override expiration interval (24 hours).
    static let defaultExpirationInterval: TimeInterval = 24 * 60 * 60

    /// The expiration interval for overrides.
    let expirationInterval: TimeInterval

    init(expirationInterval: TimeInterval = ManualOverrideManager.defaultExpirationInterval) {
        self.expirationInterval = expirationInterval
    }

    // MARK: - Effective Usage Calculation

    /// Calculates the effective usage data by applying override precedence rules.
    /// Manual overrides always take precedence when enabled and not expired.
    /// Returns the effective data along with its provenance (source).
    func calculateEffectiveUsage(
        base: UsageData,
        source: FetchSource,
        now: Date = Date()
    ) -> EffectiveUsageResult {
        guard let override = base.manualOverride,
              override.enabled,
              !isOverrideExpired(override, now: now) else {
            return EffectiveUsageResult(usageData: base, source: source)
        }

        let effective = base.getEffectiveUsage()
        return EffectiveUsageResult(usageData: effective, source: .manual)
    }

    /// Returns the data provenance for the given usage data.
    /// Returns 'manual' if overrides are active and not expired, otherwise returns the original source.
    func getDataProvenance(
        for usageData: UsageData,
        originalSource: FetchSource,
        now: Date = Date()
    ) -> FetchSource {
        guard let override = usageData.manualOverride,
              override.enabled,
              !isOverrideExpired(override, now: now) else {
            return originalSource
        }
        return .manual
    }

    // MARK: - Validation

    /// Validates override percentage values. Throws OverrideValidationError if invalid.
    func validateOverrideValues(_ override: ManualOverride) throws {
        if let inputPercentage = override.inputPercentage {
            guard inputPercentage >= 0 && inputPercentage <= 100 else {
                throw OverrideValidationError.percentageOutOfRange(
                    "Percentage must be between 0 and 100"
                )
            }
        }

        if let outputPercentage = override.outputPercentage {
            guard outputPercentage >= 0 && outputPercentage <= 100 else {
                throw OverrideValidationError.percentageOutOfRange(
                    "Percentage must be between 0 and 100"
                )
            }
        }

        if let resetTime = override.resetTime {
            guard resetTime > Date() else {
                throw OverrideValidationError.invalidResetTime(
                    "Reset time must be in the future"
                )
            }
        }
    }

    // MARK: - Override Expiration

    /// Checks whether a manual override has expired based on its createdAt timestamp.
    func isOverrideExpired(_ override: ManualOverride, now: Date = Date()) -> Bool {
        return now.timeIntervalSince(override.createdAt) >= expirationInterval
    }

    // MARK: - Override Application

    /// Applies a manual override to usage data after validation.
    /// Throws OverrideValidationError if the override values are invalid.
    func applyOverride(
        _ override: ManualOverride,
        to usageData: UsageData
    ) throws -> UsageData {
        try validateOverrideValues(override)
        return usageData.applyManualOverride(override)
    }

    /// Disables the manual override on usage data, reverting to real fetched values.
    func disableOverride(on usageData: UsageData) -> UsageData {
        return usageData.applyManualOverride(.disabled)
    }

    // MARK: - Conflict Resolution

    /// Resolves conflicts when new fetched data arrives while an override is active.
    /// The override is preserved on top of the new base data.
    func resolveConflict(
        newFetchedData: UsageData,
        existingOverride: ManualOverride?,
        now: Date = Date()
    ) -> UsageData {
        guard let override = existingOverride,
              override.enabled,
              !isOverrideExpired(override, now: now) else {
            return newFetchedData
        }

        return newFetchedData.applyManualOverride(override)
    }

    /// Handles the scenario where the app comes back online and the override may have expired.
    /// Returns the usage data with the override removed if expired.
    func handleReconnection(
        usageData: UsageData,
        now: Date = Date()
    ) -> UsageData {
        guard let override = usageData.manualOverride,
              override.enabled else {
            return usageData
        }

        if isOverrideExpired(override, now: now) {
            return disableOverride(on: usageData)
        }

        return usageData
    }
}
