import SwiftUI
import WidgetKit

// MARK: - WidgetSize

enum WidgetSize {
    case small
    case medium
}

// MARK: - ColorTheme

enum ColorTheme {
    case light
    case dark
    case auto
}

// MARK: - WidgetStyleProvider

struct WidgetStyleProvider {

    // MARK: - Font Sizing

    /// Returns a size-appropriate font for the given widget size and text style.
    /// Small widgets use slightly reduced font sizes to fit within tighter constraints,
    /// while medium widgets use standard sizes for better readability.
    static func fontForSize(_ size: WidgetSize, style: Font.TextStyle) -> Font {
        switch size {
        case .small:
            return fontForSmallWidget(style: style)
        case .medium:
            return fontForMediumWidget(style: style)
        }
    }

    private static func fontForSmallWidget(style: Font.TextStyle) -> Font {
        switch style {
        case .largeTitle:
            return .system(size: 22, weight: .bold)
        case .title:
            return .system(size: 17, weight: .bold)
        case .title2:
            return .system(size: 15, weight: .semibold)
        case .title3:
            return .system(size: 13, weight: .semibold)
        case .headline:
            return .system(size: 12, weight: .semibold)
        case .body:
            return .system(size: 11, weight: .regular)
        case .callout:
            return .system(size: 10, weight: .regular)
        case .subheadline:
            return .system(size: 10, weight: .regular)
        case .footnote:
            return .system(size: 9, weight: .regular)
        case .caption:
            return .system(size: 9, weight: .regular)
        case .caption2:
            return .system(size: 8, weight: .regular)
        @unknown default:
            return .system(size: 11, weight: .regular)
        }
    }

    private static func fontForMediumWidget(style: Font.TextStyle) -> Font {
        switch style {
        case .largeTitle:
            return .system(size: 28, weight: .bold)
        case .title:
            return .system(size: 22, weight: .bold)
        case .title2:
            return .system(size: 18, weight: .semibold)
        case .title3:
            return .system(size: 16, weight: .semibold)
        case .headline:
            return .system(size: 14, weight: .semibold)
        case .body:
            return .system(size: 14, weight: .regular)
        case .callout:
            return .system(size: 13, weight: .regular)
        case .subheadline:
            return .system(size: 12, weight: .regular)
        case .footnote:
            return .system(size: 11, weight: .regular)
        case .caption:
            return .system(size: 10, weight: .regular)
        case .caption2:
            return .system(size: 9, weight: .regular)
        @unknown default:
            return .system(size: 14, weight: .regular)
        }
    }

    // MARK: - Spacing

    /// Returns size-appropriate spacing values for the given widget size.
    static func spacingForSize(_ size: WidgetSize) -> WidgetSpacing {
        switch size {
        case .small:
            return WidgetSpacing(
                padding: 10,
                itemSpacing: 4,
                sectionSpacing: 8,
                progressBarPadding: 2
            )
        case .medium:
            return WidgetSpacing(
                padding: 14,
                itemSpacing: 6,
                sectionSpacing: 12,
                progressBarPadding: 4
            )
        }
    }

    // MARK: - Progress Bar

    /// Returns the appropriate progress bar height for the given widget size.
    static func progressBarHeight(for size: WidgetSize) -> CGFloat {
        switch size {
        case .small:
            return 6
        case .medium:
            return 10
        }
    }

    /// Returns the appropriate progress bar corner radius for the given widget size.
    static func progressBarCornerRadius(for size: WidgetSize) -> CGFloat {
        switch size {
        case .small:
            return 3
        case .medium:
            return 5
        }
    }

    // MARK: - Colors

    /// Returns ProgressColors appropriate for the given color theme.
    /// Colors are chosen to meet WCAG AA contrast requirements.
    static func colorsForTheme(_ theme: ColorTheme) -> ProgressColors {
        switch theme {
        case .light:
            return ProgressColors(
                low: Color(red: 0.20, green: 0.65, blue: 0.32),
                medium: Color(red: 0.90, green: 0.62, blue: 0.0),
                high: Color(red: 0.86, green: 0.21, blue: 0.27),
                background: Color(white: 0.90)
            )
        case .dark:
            return ProgressColors(
                low: Color(red: 0.30, green: 0.85, blue: 0.45),
                medium: Color(red: 1.0, green: 0.76, blue: 0.15),
                high: Color(red: 1.0, green: 0.38, blue: 0.38),
                background: Color(white: 0.25)
            )
        case .auto:
            return ProgressColors(
                low: .green,
                medium: .orange,
                high: .red,
                background: Color(.systemGray5)
            )
        }
    }

    // MARK: - Progress Bar Configuration

    /// Returns a default ProgressBarConfig for the given theme with standard thresholds.
    static func defaultProgressBarConfig(
        value: Double,
        theme: ColorTheme
    ) -> ProgressBarConfig {
        return ProgressBarConfig(
            value: value,
            threshold1: 50,
            threshold2: 80,
            colors: colorsForTheme(theme)
        )
    }
}

// MARK: - WidgetSpacing

struct WidgetSpacing {
    let padding: CGFloat
    let itemSpacing: CGFloat
    let sectionSpacing: CGFloat
    let progressBarPadding: CGFloat
}
