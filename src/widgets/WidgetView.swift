import SwiftUI
import WidgetKit

// MARK: - Data Staleness

private let staleThresholdSeconds: TimeInterval = 15 * 60 // 15 minutes

/// Returns true when usage data is older than 15 minutes.
func isDataStale(usage: UsageData) -> Bool {
    let age = Date().timeIntervalSince(usage.lastUpdated)
    return age > staleThresholdSeconds
}

// MARK: - Progress State Creation

/// Transforms UsageData into a ProgressBarState using the given threshold config.
/// Calculates percentage from tokensUsed/tokensLimit and determines the threshold level.
func createProgressState(from usage: UsageData, config: ProgressBarConfig) -> ProgressBarState {
    let effective = usage.getEffectiveUsage()
    let tokensUsed = effective.inputTokens + effective.outputTokens
    let tokensLimit = effective.inputLimit + effective.outputLimit

    guard tokensLimit > 0 else {
        return ProgressBarState(
            value: Double(tokensUsed),
            percentage: 0,
            color: config.colors.low,
            threshold: .low
        )
    }

    let rawPercentage = (Double(tokensUsed) / Double(tokensLimit)) * 100.0
    let percentage = min(max(round(rawPercentage), 0), 100)

    let threshold: ProgressThreshold
    let color: Color

    if percentage < config.threshold1 {
        threshold = .low
        color = config.colors.low
    } else if percentage < config.threshold2 {
        threshold = .medium
        color = config.colors.medium
    } else {
        threshold = .high
        color = config.colors.high
    }

    return ProgressBarState(
        value: Double(tokensUsed),
        percentage: percentage,
        color: color,
        threshold: threshold
    )
}

// MARK: - Progress Threshold

enum ProgressThreshold {
    case low
    case medium
    case high
}

// MARK: - Progress Bar State

struct ProgressBarState {
    let value: Double
    let percentage: Double
    let color: Color
    let threshold: ProgressThreshold
}

// MARK: - Widget Data

struct WidgetData {
    let usage: UsageData
    let progress: ProgressBarState
    let size: WidgetSize
    let config: WidgetViewConfiguration
}

// MARK: - Widget View Configuration

struct WidgetViewConfiguration {
    let showProgressBars: Bool
    let progressConfig: ProgressBarConfig
}

// MARK: - WidgetView

struct WidgetView: View {
    let data: WidgetData

    var body: some View {
        Group {
            if isDataStale(usage: data.usage) {
                StaleDataView(data: data)
            } else {
                ActiveWidgetView(data: data)
            }
        }
    }
}

// MARK: - Active Widget View

private struct ActiveWidgetView: View {
    let data: WidgetData

    var body: some View {
        switch data.size {
        case .small:
            SmallWidgetLayout(data: data)
        case .medium:
            MediumWidgetLayout(data: data)
        }
    }
}

// MARK: - Small Widget Layout

private struct SmallWidgetLayout: View {
    let data: WidgetData

    private var spacing: WidgetSpacing {
        WidgetStyleProvider.spacingForSize(.small)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: spacing.itemSpacing) {
            Text("Claude Usage")
                .font(WidgetStyleProvider.fontForSize(.small, style: .headline))
                .foregroundStyle(.primary)

            Text("\(Int(data.progress.percentage))%")
                .font(WidgetStyleProvider.fontForSize(.small, style: .largeTitle))
                .foregroundStyle(.primary)

            if data.config.showProgressBars {
                ProgressBarView(config: data.config.progressConfig)
                    .frame(height: WidgetStyleProvider.progressBarHeight(for: .small))
                    .padding(.vertical, spacing.progressBarPadding)
            }

            Spacer(minLength: 0)

            Text("Resets \(data.usage.resetTime, style: .relative)")
                .font(WidgetStyleProvider.fontForSize(.small, style: .caption))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(spacing.padding)
    }
}

// MARK: - Medium Widget Layout

private struct MediumWidgetLayout: View {
    let data: WidgetData

    private var spacing: WidgetSpacing {
        WidgetStyleProvider.spacingForSize(.medium)
    }

    var body: some View {
        HStack(spacing: spacing.sectionSpacing) {
            VStack(alignment: .leading, spacing: spacing.itemSpacing) {
                Text("Claude Usage")
                    .font(WidgetStyleProvider.fontForSize(.medium, style: .headline))
                    .foregroundStyle(.primary)

                Text("\(Int(data.progress.percentage))%")
                    .font(WidgetStyleProvider.fontForSize(.medium, style: .largeTitle))
                    .foregroundStyle(.primary)

                Spacer(minLength: 0)

                Text("Resets \(data.usage.resetTime, style: .relative)")
                    .font(WidgetStyleProvider.fontForSize(.medium, style: .caption))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            VStack(alignment: .leading, spacing: spacing.itemSpacing) {
                if data.config.showProgressBars {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Input")
                            .font(WidgetStyleProvider.fontForSize(.medium, style: .caption))
                            .foregroundStyle(.secondary)
                        ProgressBarView(config: WidgetLayoutHelper.inputProgressConfig(
                            usage: data.usage,
                            config: data.config.progressConfig
                        ))
                        .frame(height: WidgetStyleProvider.progressBarHeight(for: .medium))
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Output")
                            .font(WidgetStyleProvider.fontForSize(.medium, style: .caption))
                            .foregroundStyle(.secondary)
                        ProgressBarView(config: WidgetLayoutHelper.outputProgressConfig(
                            usage: data.usage,
                            config: data.config.progressConfig
                        ))
                        .frame(height: WidgetStyleProvider.progressBarHeight(for: .medium))
                    }
                }

                Spacer(minLength: 0)
            }
        }
        .padding(spacing.padding)
    }
}

// MARK: - Stale Data View

private struct StaleDataView: View {
    let data: WidgetData

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: "clock.badge.exclamationmark")
                .font(.title2)
                .foregroundStyle(.secondary)

            Text("Data may be outdated")
                .font(WidgetStyleProvider.fontForSize(data.size, style: .caption))
                .foregroundStyle(.secondary)

            Text("Updated \(data.usage.lastUpdated, style: .relative) ago")
                .font(WidgetStyleProvider.fontForSize(data.size, style: .caption2))
                .foregroundStyle(.tertiary)
        }
        .padding()
        .accessibilityLabel("Usage data may be outdated")
    }
}
