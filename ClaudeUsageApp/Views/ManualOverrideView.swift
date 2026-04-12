import SwiftUI

struct ManualOverrideView: View {
    @State private var overrideEnabled: Bool = false
    @State private var inputPercentage: Double = 0
    @State private var outputPercentage: Double = 0
    @State private var realInputPercentage: Double = 42
    @State private var realOutputPercentage: Double = 28
    @State private var resetTime: Date = Date().addingTimeInterval(14400)

    private var displayInputPercentage: Binding<Double> {
        Binding(
            get: { overrideEnabled ? inputPercentage : realInputPercentage },
            set: { inputPercentage = $0 }
        )
    }

    private var displayOutputPercentage: Binding<Double> {
        Binding(
            get: { overrideEnabled ? outputPercentage : realOutputPercentage },
            set: { outputPercentage = $0 }
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                overrideToggleSection

                statusBanner

                UsageSlider(
                    title: "Input Tokens",
                    value: displayInputPercentage,
                    isEnabled: overrideEnabled,
                    resetTime: resetTime
                )

                UsageSlider(
                    title: "Output Tokens",
                    value: displayOutputPercentage,
                    isEnabled: overrideEnabled,
                    resetTime: resetTime
                )

                if overrideEnabled {
                    resetButton
                }
            }
            .padding()
        }
        .navigationTitle("Manual Override")
        .background(Color(.systemGroupedBackground))
    }

    private var overrideToggleSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Override Mode")
                    .font(.headline)

                Text(overrideEnabled ? "Manual values active" : "Showing real usage data")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Toggle("Override Mode", isOn: $overrideEnabled)
                .labelsHidden()
                .accessibilityLabel("Override mode toggle")
                .accessibilityHint("Enable to manually set usage percentages")
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        )
    }

    private var statusBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: overrideEnabled ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundStyle(overrideEnabled ? .orange : .green)

            Text(overrideEnabled ? "Override Active - Values are manually set" : "Live Data - Showing real usage")
                .font(.subheadline)
                .fontWeight(.medium)

            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(overrideEnabled ? Color.orange.opacity(0.1) : Color.green.opacity(0.1))
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(overrideEnabled ? "Override mode is active" : "Showing live data")
    }

    private var resetButton: some View {
        Button(action: {
            withAnimation {
                inputPercentage = realInputPercentage
                outputPercentage = realOutputPercentage
                overrideEnabled = false
            }
        }) {
            HStack {
                Image(systemName: "arrow.counterclockwise")
                Text("Reset to Real Values")
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemBackground))
                    .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
            )
        }
        .accessibilityLabel("Reset overrides")
        .accessibilityHint("Returns to showing real usage data")
    }
}

#Preview {
    NavigationStack {
        ManualOverrideView()
    }
}
