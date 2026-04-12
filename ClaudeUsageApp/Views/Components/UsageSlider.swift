import SwiftUI

struct UsageSlider: View {
    let title: String
    @Binding var percentage: Double
    let isEnabled: Bool
    var config: ProgressBarConfig = .default

    private var displayPercentage: Double {
        min(max(percentage, 0), 100)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)

                Spacer()

                Text("\(Int(displayPercentage))%")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(
                        ProgressBarView(value: displayPercentage / 100, config: config).barColor
                    )
                    .monospacedDigit()
            }

            ProgressBarView(value: displayPercentage / 100, config: config)

            Slider(
                value: $percentage,
                in: 0...100,
                step: 1
            )
            .disabled(!isEnabled)
            .tint(
                ProgressBarView(value: displayPercentage / 100, config: config).barColor
            )
            .accessibilityLabel("\(title) override slider")
            .accessibilityValue("\(Int(displayPercentage)) percent")
            .accessibilityHint(isEnabled ? "Adjust \(title.lowercased()) usage percentage" : "Enable override mode to adjust")
        }
        .opacity(isEnabled ? 1.0 : 0.5)
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State private var value: Double = 65

        var body: some View {
            VStack(spacing: 24) {
                UsageSlider(
                    title: "Input Tokens",
                    percentage: $value,
                    isEnabled: true
                )
                UsageSlider(
                    title: "Output Tokens",
                    percentage: .constant(30),
                    isEnabled: false
                )
            }
            .padding()
        }
    }

    return PreviewWrapper()
}
