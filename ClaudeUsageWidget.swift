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

// MARK: - Timeline Provider

struct ClaudeUsageTimelineProvider: TimelineProvider {
    typealias Entry = WidgetEntry

    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(
            date: Date(),
            usageData: nil,
            configuration: widgetConfiguration(for: context)
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let entry = WidgetEntry(
            date: Date(),
            usageData: nil,
            configuration: widgetConfiguration(for: context)
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let currentDate = Date()
        let refreshInterval: TimeInterval = 60 // 1 minute
        let maxEntries = 60
        let config = widgetConfiguration(for: context)

        var entries: [WidgetEntry] = []

        for offset in 0..<maxEntries {
            let entryDate = currentDate.addingTimeInterval(Double(offset) * refreshInterval)
            let entry = WidgetEntry(
                date: entryDate,
                usageData: nil,
                configuration: config
            )
            entries.append(entry)
        }

        let reloadDate = currentDate.addingTimeInterval(Double(maxEntries) * refreshInterval)
        let timeline = Timeline(entries: entries, policy: .after(reloadDate))
        completion(timeline)
    }

    // MARK: - Helpers

    private func widgetConfiguration(for context: Context) -> WidgetConfiguration {
        switch context.family {
        case .systemSmall:
            return WidgetConfiguration(size: .small)
        case .systemMedium:
            return WidgetConfiguration(size: .medium)
        default:
            return WidgetConfiguration(size: .small)
        }
    }
}

// MARK: - Widget Bundle Entry Point

@main
struct ClaudeUsageWidgetBundle: WidgetBundle {
    var body: some Widget {
        ClaudeUsageWidget()
    }
}
