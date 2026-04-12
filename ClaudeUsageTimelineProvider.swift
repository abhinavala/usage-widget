import SwiftUI
import WidgetKit

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

    /// Generates a timeline of entries for the widget.
    func timeline(in context: Context) async -> Timeline<WidgetEntry> {
        let currentDate = Date()
        let refreshInterval: TimeInterval = 60
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
        return Timeline(entries: entries, policy: .after(reloadDate))
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
