import SwiftUI

struct ProgressBarConfig {
    var value: Double
    var threshold1: Double
    var threshold2: Double
    var colors: ProgressColors
}

struct ProgressColors {
    var low: Color
    var medium: Color
    var high: Color
    var background: Color
}

struct ProgressBarView: View {
    let config: ProgressBarConfig

    var currentColor: Color {
        if config.value < config.threshold1 {
            return config.colors.low
        } else if config.value > config.threshold2 {
            return config.colors.high
        } else {
            return config.colors.medium
        }
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(config.colors.background)
                    .frame(height: 12)

                RoundedRectangle(cornerRadius: 8)
                    .fill(currentColor)
                    .frame(
                        width: max(0, min(geometry.size.width * config.value / 100.0, geometry.size.width)),
                        height: 12
                    )
                    .animation(.easeInOut(duration: 0.2), value: config.value)
            }
        }
        .frame(height: 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Usage progress")
        .accessibilityValue("\(Int(config.value)) percent")
    }
}

#Preview {
    ProgressBarView(config: ProgressBarConfig(
        value: 65,
        threshold1: 50,
        threshold2: 80,
        colors: ProgressColors(
            low: .green,
            medium: .orange,
            high: .red,
            background: Color(.systemGray5)
        )
    ))
    .padding()
}
