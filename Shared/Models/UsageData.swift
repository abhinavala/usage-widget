import Foundation

struct UsageData: Codable, Equatable {
    var inputTokens: Int
    var outputTokens: Int
    var inputLimit: Int
    var outputLimit: Int
    var resetTime: Date
    var lastUpdated: Date

    private var manualOverride: ManualOverride = .disabled

    enum CodingKeys: String, CodingKey {
        case inputTokens, outputTokens, inputLimit, outputLimit
        case resetTime, lastUpdated, manualOverride
    }

    init(
        inputTokens: Int,
        outputTokens: Int,
        inputLimit: Int,
        outputLimit: Int,
        resetTime: Date,
        lastUpdated: Date
    ) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.inputLimit = inputLimit
        self.outputLimit = outputLimit
        self.resetTime = resetTime
        self.lastUpdated = lastUpdated
    }

    func isUsingOverrides() -> Bool {
        manualOverride.enabled
    }

    func getEffectiveUsage() -> UsageData {
        guard manualOverride.enabled else { return self }

        var result = self
        if let inputPct = manualOverride.inputPercentage {
            result.inputTokens = Int(Double(inputLimit) * inputPct / 100.0)
        }
        if let outputPct = manualOverride.outputPercentage {
            result.outputTokens = Int(Double(outputLimit) * outputPct / 100.0)
        }
        if let overrideReset = manualOverride.resetTime {
            result.resetTime = overrideReset
        }
        result.lastUpdated = Date()
        return result
    }

    mutating func applyManualOverride(_ override: ManualOverride) {
        manualOverride = override
    }

    func currentOverride() -> ManualOverride {
        manualOverride
    }
}
