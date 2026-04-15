import SwiftUI

struct ProgressConfigView: View {
    @State private var lowThreshold: Double = 50
    @State private var highThreshold: Double = 80
    @State private var barHeight: Double = 12
    @State private var lowColor: Color = .green
    @State private var mediumColor: Color = .orange
    @State private var highColor: Color = .red

    var body: some View {
        List {
            thresholdSection
            appearanceSection
            previewSection
        }
        .navigationTitle("Progress Bar")
    }

    // MARK: - Threshold Section

    private var thresholdSection: some View {
        Section {
            VStack(alignment: .leading) {
                Text("Low → Medium: \(Int(lowThreshold))%")
                Slider(value: $lowThreshold, in: 10...90, step: 5)
                    .accessibilityLabel("Low to medium threshold")
                    .accessibilityValue("\(Int(lowThreshold)) percent")
            }

            VStack(alignment: .leading) {
                Text("Medium → High: \(Int(highThreshold))%")
                Slider(value: $highThreshold, in: 10...99, step: 5)
                    .accessibilityLabel("Medium to high threshold")
                    .accessibilityValue("\(Int(highThreshold)) percent")
            }
        } header: {
            Text("Thresholds")
        } footer: {
            Text("Set the usage percentages at which the progress bar changes color.")
        }
    }

    // MARK: - Appearance Section

    private var appearanceSection: some View {
        Section {
            ColorPickerRow(title: "Low Usage", selectedColor: $lowColor)
            ColorPickerRow(title: "Medium Usage", selectedColor: $mediumColor)
            ColorPickerRow(title: "High Usage", selectedColor: $highColor)

            VStack(alignment: .leading) {
                Text("Bar Height: \(Int(barHeight))pt")
                Slider(value: $barHeight, in: 4...20, step: 2)
                    .accessibilityLabel("Progress bar height")
                    .accessibilityValue("\(Int(barHeight)) points")
            }
        } header: {
            Text("Appearance")
        }
    }

    // MARK: - Preview Section

    private var previewSection: some View {
        Section {
            VStack(spacing: 12) {
                ProgressBarView(config: ProgressBarConfig(
                    value: 30,
                    threshold1: lowThreshold,
                    threshold2: highThreshold,
                    colors: ProgressColors(
                        low: lowColor,
                        medium: mediumColor,
                        high: highColor,
                        background: Color(.systemGray5)
                    )
                ))

                ProgressBarView(config: ProgressBarConfig(
                    value: 65,
                    threshold1: lowThreshold,
                    threshold2: highThreshold,
                    colors: ProgressColors(
                        low: lowColor,
                        medium: mediumColor,
                        high: highColor,
                        background: Color(.systemGray5)
                    )
                ))

                ProgressBarView(config: ProgressBarConfig(
                    value: 90,
                    threshold1: lowThreshold,
                    threshold2: highThreshold,
                    colors: ProgressColors(
                        low: lowColor,
                        medium: mediumColor,
                        high: highColor,
                        background: Color(.systemGray5)
                    )
                ))
            }
            .padding(.vertical, 8)
        } header: {
            Text("Preview")
        }
    }
}

#Preview {
    NavigationStack {
        ProgressConfigView()
    }
}
