import SwiftUI
import WidgetKit

// MARK: - Widget Configuration

struct ClaudeUsageWidget: Widget {
    let kind: String = "ClaudeUsageWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClaudeUsageTimelineProvider()) { entry in
            ClaudeUsageWidgetView(entry: entry)
        }
        .configurationDisplayName("Claude Usage")
        .description("Monitor your Claude API usage at a glance.")
        .supportedFamilies(supportedFamilies())
    }

    static func supportedFamilies() -> [WidgetFamily] {
        return [.systemSmall, .systemMedium]
    }
}

// MARK: - Widget Entry

struct WidgetEntry: TimelineEntry {
    let date: Date
    let usageData: UsageData?
    let configuration: WidgetConfiguration
}

// MARK: - Widget Configuration

struct WidgetConfiguration {
    let size: WidgetSize

    init(size: WidgetSize = .small) {
        self.size = size
    }
}

// MARK: - Widget Size

enum WidgetSize: String {
    case small = "small"
    case medium = "medium"
}

// MARK: - Widget Bundle Entry Point

@main
struct ClaudeUsageWidgetBundle: WidgetBundle {
    var body: some Widget {
        ClaudeUsageWidget()
    }
}
