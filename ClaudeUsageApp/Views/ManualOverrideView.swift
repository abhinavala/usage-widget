import SwiftUI

struct ManualOverrideView: View {
    @State private var usageData: UsageData
    @State private var overrideEnabled: Bool
    @State private var inputPercentage: Double
    @State private var outputPercentage: Double

    private let progressConfig: ProgressBarConfig

    init(usageData: UsageData, progressConfig: ProgressBarConfig = .default) {
        let currentOverride = usageData.currentOverride()
        _usageData = State(initialValue: usageData)
        _overrideEnabled = State(initialValue: currentOverride.enabled)
        _inputPercentage = State(initialValue: currentOverride.inputPercentage ?? Self.calculatePercentage(
            used: usageData.inputTokens, limit: usageData.inputLimit
        ))
        _outputPercentage = State(initialValue: currentOverride.outputPercentage ?? Self.calculatePercentage(
            used: usageData.outputTokens, limit: usageData.outputLimit
        ))
        self.progressConfig = progressConfig
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                statusBanner
                slidersSection
                realDataSection
                resetTimeSection
            }
            .padding()
        }
        .navigationTitle("Manual Override")
        .onChange(of: overrideEnabled) { _, newValue in
            applyOverride()
        }
        .onChange(of: inputPercentage) { _, _ in
            if overrideEnabled { applyOverride() }
        }
        .onChange(of: outputPercentage) { _, _ in
            if overrideEnabled { applyOverride() }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 8) {
            Text("Usage Override")
                .font(.title2)
                .fontWeight(.bold)

            Text("Manually set usage percentages for widget display")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Status Banner

    private var statusBanner: some View {
        HStack {
            Image(systemName: overrideEnabled ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundColor(overrideEnabled ? .orange : .green)

            Text(overrideEnabled ? "Override Active" : "Showing Real Data")
                .font(.subheadline)
                .fontWeight(.medium)

            Spacer()

            Toggle("", isOn: $overrideEnabled)
                .labelsHidden()
                .accessibilityLabel("Override mode toggle")
                .accessibilityHint(overrideEnabled ? "Disable to show real data" : "Enable to set custom usage values")
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(overrideEnabled ? Color.orange.opacity(0.1) : Color.green.opacity(0.1))
        )
    }

    // MARK: - Sliders

    private var slidersSection: some View {
        VStack(spacing: 20) {
            UsageSlider(
                title: "Input Tokens",
                percentage: $inputPercentage,
                isEnabled: overrideEnabled,
                config: progressConfig
            )

            UsageSlider(
                title: "Output Tokens",
                percentage: $outputPercentage,
                isEnabled: overrideEnabled,
                config: progressConfig
            )

            if overrideEnabled {
                Button(action: resetToReal) {
                    Label("Reset to Real Values", systemImage: "arrow.counterclockwise")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .accessibilityLabel("Reset overrides to real usage values")
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.1))
        )
    }

    // MARK: - Real Data Display

    private var realDataSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Actual Usage")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            HStack {
                realDataRow(
                    label: "Input",
                    used: usageData.inputTokens,
                    limit: usageData.inputLimit
                )
                Spacer()
                realDataRow(
                    label: "Output",
                    used: usageData.outputTokens,
                    limit: usageData.outputLimit
                )
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.1))
        )
    }

    private func realDataRow(label: String, used: Int, limit: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(formatTokenCount(used))
                .font(.headline)
                .fontWeight(.bold)

            Text("of \(formatTokenCount(limit))")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(formatTokenCount(used)) of \(formatTokenCount(limit))")
    }

    // MARK: - Reset Time

    private var resetTimeSection: some View {
        HStack {
            Image(systemName: "clock")
                .foregroundColor(.secondary)
            Text("Resets \(usageData.resetTime, style: .relative)")
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            if isStale {
                Label("Stale", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Helpers

    private var isStale: Bool {
        Date().timeIntervalSince(usageData.lastUpdated) > 15 * 60
    }

    private func applyOverride() {
        let override = ManualOverride(
            enabled: overrideEnabled,
            inputPercentage: overrideEnabled ? inputPercentage : nil,
            outputPercentage: overrideEnabled ? outputPercentage : nil,
            resetTime: nil
        )
        usageData.applyManualOverride(override)
    }

    private func resetToReal() {
        let realInputPct = Self.calculatePercentage(used: usageData.inputTokens, limit: usageData.inputLimit)
        let realOutputPct = Self.calculatePercentage(used: usageData.outputTokens, limit: usageData.outputLimit)
        inputPercentage = realInputPct
        outputPercentage = realOutputPct
    }

    static func calculatePercentage(used: Int, limit: Int) -> Double {
        guard limit > 0 else { return 0 }
        return min(Double(used) / Double(limit) * 100, 100)
    }

    private func formatTokenCount(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.1fM", Double(count) / 1_000_000)
        } else if count >= 1_000 {
            return String(format: "%.1fK", Double(count) / 1_000)
        }
        return "\(count)"
    }
}

#Preview {
    NavigationStack {
        ManualOverrideView(
            usageData: UsageData(
                inputTokens: 350_000,
                outputTokens: 125_000,
                inputLimit: 500_000,
                outputLimit: 500_000,
                resetTime: Date().addingTimeInterval(3600),
                lastUpdated: Date()
            )
        )
    }
}
