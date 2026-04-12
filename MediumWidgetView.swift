import SwiftUI
import WidgetKit

struct ProgressBarConfiguration {
    let lowThreshold: Double
    let mediumThreshold: Double
    let highThreshold: Double
    let colors: ProgressColors

    static let `default` = ProgressBarConfiguration(
        lowThreshold: 0.50,
        mediumThreshold: 0.75,
        highThreshold: 0.90,
        colors: ProgressColors(
            low: .green,
            medium: .yellow,
            high: .orange,
            critical: .red
        )
    )
}

struct ProgressColors {
    let low: Color
    let medium: Color
    let high: Color
    let critical: Color
}

struct MediumWidgetView: View {
    let entry: WidgetEntry
    let progressConfig: ProgressBarConfiguration

    init(entry: WidgetEntry, progressConfig: ProgressBarConfiguration = .default) {
        self.entry = entry
        self.progressConfig = progressConfig
    }

    var body: some View {
        Group {
            if let usageData = entry.usageData {
                contentView(usageData: usageData)
            } else {
                placeholderView
            }
        }
        .padding(12)
    }

    // MARK: - Content View

    private func contentView(usageData: UsageData) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 16) {
                usageColumn(
                    title: "Tokens",
                    used: usageData.tokensUsed,
                    limit: usageData.tokensLimit
                )
                usageColumn(
                    title: "Requests",
                    used: usageData.requestsUsed,
                    limit: usageData.requestsLimit
                )
            }

            HStack {
                resetTimeLabel(resetTime: usageData.resetTime)
                Spacer()
                lastUpdatedLabel(
                    lastUpdated: usageData.lastUpdated,
                    isStale: isDataStale(lastUpdated: usageData.lastUpdated, now: entry.date)
                )
            }
            .font(.caption2)
            .foregroundColor(.secondary)
        }
    }

    // MARK: - Usage Column

    private func usageColumn(title: String, used: Int, limit: Int) -> some View {
        let percentage = limit > 0 ? Double(used) / Double(limit) : 0.0
        let clampedPercentage = min(max(percentage, 0.0), 1.0)
        let color = progressColor(percentage: clampedPercentage, config: progressConfig)

        return VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            Text("\(Int(clampedPercentage * 100))%")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            ProgressView(value: clampedPercentage)
                .tint(color)

            Text("\(formatNumber(used)) / \(formatNumber(limit))")
                .font(.caption2)
                .foregroundColor(.secondary)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Footer Labels

    private func resetTimeLabel(resetTime: String) -> some View {
        HStack(spacing: 2) {
            Image(systemName: "arrow.clockwise")
                .font(.caption2)
            Text("Resets \(resetTime)")
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }

    private func lastUpdatedLabel(lastUpdated: String, isStale: Bool) -> some View {
        HStack(spacing: 2) {
            if isStale {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.caption2)
                    .foregroundColor(.orange)
            }
            Text(lastUpdated)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .foregroundColor(isStale ? .orange : .secondary)
        }
    }

    // MARK: - Placeholder

    private var placeholderView: some View {
        VStack(spacing: 8) {
            HStack(spacing: 16) {
                placeholderColumn(title: "Tokens")
                placeholderColumn(title: "Requests")
            }
            HStack {
                Text("No data available")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Spacer()
            }
        }
    }

    private func placeholderColumn(title: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
            Text("--%")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.secondary)
            ProgressView(value: 0.0)
                .tint(.secondary)
            Text("-- / --")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Helpers

    private func formatNumber(_ value: Int) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", Double(value) / 1_000)
        }
        return "\(value)"
    }
}

// MARK: - Pure Functions

func progressColor(percentage: Double, config: ProgressBarConfiguration) -> Color {
    if percentage >= config.highThreshold {
        return config.colors.critical
    } else if percentage >= config.mediumThreshold {
        return config.colors.high
    } else if percentage >= config.lowThreshold {
        return config.colors.medium
    }
    return config.colors.low
}

func isDataStale(lastUpdated: String, now: Date, staleThresholdMinutes: Int = 15) -> Bool {
    let formatter = ISO8601DateFormatter()
    guard let updatedDate = formatter.date(from: lastUpdated) else {
        return true
    }
    let elapsed = now.timeIntervalSince(updatedDate)
    return elapsed > Double(staleThresholdMinutes * 60)
}

// MARK: - Preview

#if DEBUG
struct MediumWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        MediumWidgetView(
            entry: WidgetEntry(
                date: Date(),
                usageData: UsageData(
                    tokensUsed: 750_000,
                    tokensLimit: 1_000_000,
                    requestsUsed: 42,
                    requestsLimit: 50,
                    resetTime: "3:00 PM",
                    lastUpdated: ISO8601DateFormatter().string(from: Date())
                ),
                configuration: WidgetConfiguration()
            )
        )
        .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
#endif
