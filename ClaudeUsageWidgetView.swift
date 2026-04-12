import SwiftUI
import WidgetKit

struct WidgetEntry: TimelineEntry {
    let date: Date
    let usageData: UsageData?
    let configuration: WidgetConfiguration
}

enum WidgetSize {
    case small
    case medium

    init(family: WidgetFamily) {
        switch family {
        case .systemSmall:
            self = .small
        case .systemMedium:
            self = .medium
        default:
            self = .small
        }
    }
}

func widgetSize(for family: WidgetFamily) -> WidgetSize {
    switch family {
    case .systemSmall:
        return .small
    case .systemMedium:
        return .medium
    default:
        return .small
    }
}

struct ClaudeUsageWidgetView: View {
    let entry: WidgetEntry

    @Environment(\.widgetFamily) var widgetFamily

    var body: some View {
        viewForSize(widgetSize(for: widgetFamily))
    }

    @ViewBuilder
    func viewForSize(_ size: WidgetSize) -> some View {
        switch size {
        case .small:
            SmallWidgetView(entry: entry)
        case .medium:
            MediumWidgetView(entry: entry)
        }
    }
}

struct UnsupportedWidgetView: View {
    var body: some View {
        VStack {
            Image(systemName: "exclamationmark.triangle")
                .font(.title)
                .foregroundStyle(.secondary)
            Text("Unsupported widget size")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .accessibilityLabel("Unsupported widget size")
    }
}

#Preview("Small", as: .systemSmall) {
    ClaudeUsageWidget()
} timeline: {
    WidgetEntry(date: Date(), usageData: nil, configuration: WidgetConfiguration(showTokens: true, showRequests: true))
}

#Preview("Medium", as: .systemMedium) {
    ClaudeUsageWidget()
} timeline: {
    WidgetEntry(date: Date(), usageData: nil, configuration: WidgetConfiguration(showTokens: true, showRequests: true))
}
