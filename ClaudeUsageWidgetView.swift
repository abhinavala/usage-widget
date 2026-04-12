import SwiftUI
import WidgetKit

// MARK: - Widget Size Enum

enum WidgetSize: String {
    case small = "small"
    case medium = "medium"
}

// MARK: - Size-Aware Widget View Router

struct ClaudeUsageWidgetView: View {
    let entry: WidgetEntry

    @Environment(\.widgetFamily) var widgetFamily

    var body: some View {
        viewForSize(widgetSize(from: widgetFamily))
    }

    // MARK: - Size Detection

    func widgetSize(from family: WidgetFamily) -> WidgetSize? {
        switch family {
        case .systemSmall:
            return .small
        case .systemMedium:
            return .medium
        default:
            return nil
        }
    }

    // MARK: - View Routing

    @ViewBuilder
    func viewForSize(_ size: WidgetSize?) -> some View {
        switch size {
        case .small:
            SmallWidgetView(entry: entry)
        case .medium:
            MediumWidgetView(entry: entry)
        case nil:
            fallbackView
        }
    }

    // MARK: - Fallback View

    private var fallbackView: some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Unsupported widget size")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Preview

#if DEBUG
struct ClaudeUsageWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        let entry = WidgetEntry(
            date: Date(),
            usageData: UsageData(
                tokensUsed: 500_000,
                tokensLimit: 1_000_000,
                requestsUsed: 25,
                requestsLimit: 50,
                resetTime: "3:00 PM",
                lastUpdated: ISO8601DateFormatter().string(from: Date())
            ),
            configuration: WidgetConfiguration()
        )

        ClaudeUsageWidgetView(entry: entry)
            .previewContext(WidgetPreviewContext(family: .systemSmall))

        ClaudeUsageWidgetView(entry: entry)
            .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
#endif
