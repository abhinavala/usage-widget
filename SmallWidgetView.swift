import SwiftUI
import WidgetKit

// MARK: - Usage Type

enum UsageType {
    case tokens
    case requests
}

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let entry: WidgetEntry

    var body: some View {
        if let usageData = entry.usageData {
            dataView(usageData: usageData)
                .padding(12)
        } else {
            noDataView
                .padding(12)
        }
    }

    // MARK: - Data View

    @ViewBuilder
    private func dataView(usageData: UsageData) -> some View {
        let effective = usageData.getEffectiveUsage()
        let priority = priorityUsageType(usageData: effective)
        let percentage = usagePercentage(usageData: effective, type: priority)
        let label = priority == .tokens ? "Tokens" : "Requests"
        let color = colorForPercentage(percentage)

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(color)

                Text("Claude")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
            }

            Spacer()

            Text("\(Int(percentage))%")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)

            ProgressBarView(config: ProgressBarConfig(
                value: percentage,
                threshold1: 50,
                threshold2: 80,
                colors: ProgressColors(
                    low: .green,
                    medium: .orange,
                    high: .red,
                    background: Color(.systemGray5)
                )
            ))

            Text("Resets \(formattedResetTime(effective.resetTime))")
                .font(.system(size: 9, weight: .regular))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    // MARK: - No Data View

    private var noDataView: some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 24))
                .foregroundStyle(.secondary)

            Text("No Data")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.secondary)

            Text("Open app to sync")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    /// Determines which usage type to display based on which has a higher percentage.
    /// Tokens are shown when token percentage >= request percentage.
    static func priorityUsageType(usageData: UsageData) -> UsageType {
        let effective = usageData.getEffectiveUsage()
        let tokenPct = effective.inputLimit > 0
            ? Double(effective.inputTokens) / Double(effective.inputLimit) * 100.0
            : 0.0
        let requestPct = effective.outputLimit > 0
            ? Double(effective.outputTokens) / Double(effective.outputLimit) * 100.0
            : 0.0

        return tokenPct >= requestPct ? .tokens : .requests
    }

    private func priorityUsageType(usageData: UsageData) -> UsageType {
        SmallWidgetView.priorityUsageType(usageData: usageData)
    }

    private func usagePercentage(usageData: UsageData, type: UsageType) -> Double {
        switch type {
        case .tokens:
            guard usageData.inputLimit > 0 else { return 0 }
            return min(Double(usageData.inputTokens) / Double(usageData.inputLimit) * 100.0, 100.0)
        case .requests:
            guard usageData.outputLimit > 0 else { return 0 }
            return min(Double(usageData.outputTokens) / Double(usageData.outputLimit) * 100.0, 100.0)
        }
    }

    private func colorForPercentage(_ percentage: Double) -> Color {
        if percentage < 50 {
            return .green
        } else if percentage > 80 {
            return .red
        } else {
            return .orange
        }
    }

    private func formattedResetTime(_ date: Date) -> String {
        let now = Date()
        let interval = date.timeIntervalSince(now)

        if interval <= 0 {
            return "soon"
        }

        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60

        if hours > 24 {
            let days = hours / 24
            return "in \(days)d"
        } else if hours > 0 {
            return "in \(hours)h \(minutes)m"
        } else {
            return "in \(minutes)m"
        }
    }
}

// MARK: - Widget Entry View

struct ClaudeUsageWidgetView: View {
    let entry: WidgetEntry

    var body: some View {
        switch entry.configuration.size {
        case .small:
            SmallWidgetView(entry: entry)
        case .medium:
            // Medium widget view will be implemented by a separate task
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Previews

#Preview("Small Widget - With Data") {
    let entry = WidgetEntry(
        date: Date(),
        usageData: UsageData(
            inputTokens: 65_000,
            outputTokens: 30_000,
            inputLimit: 100_000,
            outputLimit: 100_000,
            resetTime: Date().addingTimeInterval(3600 * 4),
            lastUpdated: Date()
        ),
        configuration: WidgetConfiguration(size: .small)
    )
    SmallWidgetView(entry: entry)
        .previewContext(WidgetPreviewContext(family: .systemSmall))
}

#Preview("Small Widget - No Data") {
    let entry = WidgetEntry(
        date: Date(),
        usageData: nil,
        configuration: WidgetConfiguration(size: .small)
    )
    SmallWidgetView(entry: entry)
        .previewContext(WidgetPreviewContext(family: .systemSmall))
}
