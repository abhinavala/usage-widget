import SwiftUI

struct ProgressBarConfig {
    let threshold1: Double
    let threshold2: Double
    let colors: ProgressBarColors

    static let `default` = ProgressBarConfig(
        threshold1: 0.50,
        threshold2: 0.75,
        colors: .default
    )
}

struct ProgressBarColors {
    let low: Color
    let medium: Color
    let high: Color
    let background: Color

    static let `default` = ProgressBarColors(
        low: .green,
        medium: .yellow,
        high: .red,
        background: Color.gray.opacity(0.2)
    )
}

struct ProgressBarView: View {
    let value: Double
    var config: ProgressBarConfig = .default

    private var clampedValue: Double {
        min(max(value, 0.0), 1.0)
    }

    var barColor: Color {
        progressColor(for: clampedValue)
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(config.colors.background)
                    .frame(height: 8)

                RoundedRectangle(cornerRadius: 4)
                    .fill(barColor)
                    .frame(width: geometry.size.width * clampedValue, height: 8)
                    .animation(.easeInOut(duration: 0.2), value: clampedValue)
            }
        }
        .frame(height: 8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Usage progress")
        .accessibilityValue("\(Int(clampedValue * 100)) percent")
    }

    func progressColor(for percentage: Double) -> Color {
        if percentage >= config.threshold2 {
            return config.colors.high
        } else if percentage >= config.threshold1 {
            return config.colors.medium
        } else {
            return config.colors.low
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        ProgressBarView(value: 0.25)
        ProgressBarView(value: 0.60)
        ProgressBarView(value: 0.85)
    }
    .padding()
}
