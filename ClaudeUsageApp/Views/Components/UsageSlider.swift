import SwiftUI

struct UsageSlider: View {
    let title: String
    @Binding var value: Double
    let isEnabled: Bool
    let resetTime: Date?

    private var progressConfig: ProgressBarConfig {
        ProgressBarConfig(
            value: value,
            threshold1: 50,
            threshold2: 80,
            colors: ProgressColors(
                low: .green,
                medium: .orange,
                high: .red,
                background: Color(.systemGray5)
            )
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline)

                Spacer()

                Text("\(Int(value))%")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(isEnabled ? .primary : .secondary)
                    .contentTransition(.numericText())
                    .animation(.easeInOut(duration: 0.2), value: value)
            }

            ProgressBarView(config: progressConfig)

            Slider(
                value: $value,
                in: 0...100,
                step: 1
            )
            .disabled(!isEnabled)
            .tint(isEnabled ? .blue : .gray)
            .accessibilityLabel("\(title) slider")
            .accessibilityValue("\(Int(value)) percent")
            .accessibilityHint(isEnabled ? "Adjust \(title.lowercased()) usage percentage" : "Enable override mode to adjust")

            if let resetTime = resetTime {
                Text("Resets: \(resetTime, style: .relative) from now")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        )
    }
}

#Preview {
    UsageSlider(
        title: "Input Tokens",
        value: .constant(65),
        isEnabled: true,
        resetTime: Date().addingTimeInterval(3600)
    )
    .padding()
}
