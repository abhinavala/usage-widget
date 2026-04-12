import SwiftUI
import WidgetKit

// MARK: - Widget Style Provider

struct WidgetStyleProvider {
    let size: WidgetSize

    // MARK: - Font Sizing

    func fontForSize(style: Font.TextStyle) -> Font {
        switch size {
        case .small:
            return smallFont(for: style)
        case .medium:
            return mediumFont(for: style)
        }
    }

    private func smallFont(for style: Font.TextStyle) -> Font {
        switch style {
        case .title:
            return .system(size: 16, weight: .bold)
        case .title2:
            return .system(size: 14, weight: .bold)
        case .headline:
            return .system(size: 13, weight: .semibold)
        case .body:
            return .system(size: 12, weight: .regular)
        case .caption:
            return .system(size: 10, weight: .medium)
        case .caption2:
            return .system(size: 9, weight: .regular)
        default:
            return .system(size: 12, weight: .regular)
        }
    }

    private func mediumFont(for style: Font.TextStyle) -> Font {
        switch style {
        case .title:
            return .system(size: 20, weight: .bold)
        case .title2:
            return .system(size: 18, weight: .bold)
        case .headline:
            return .system(size: 15, weight: .semibold)
        case .body:
            return .system(size: 14, weight: .regular)
        case .caption:
            return .system(size: 12, weight: .medium)
        case .caption2:
            return .system(size: 10, weight: .regular)
        default:
            return .system(size: 14, weight: .regular)
        }
    }

    // MARK: - Spacing

    var contentPadding: CGFloat {
        switch size {
        case .small: return 10
        case .medium: return 12
        }
    }

    var itemSpacing: CGFloat {
        switch size {
        case .small: return 4
        case .medium: return 8
        }
    }

    var sectionSpacing: CGFloat {
        switch size {
        case .small: return 6
        case .medium: return 16
        }
    }

    // MARK: - Progress Bar

    var progressBarHeight: CGFloat {
        switch size {
        case .small: return 4
        case .medium: return 6
        }
    }

    var progressBarCornerRadius: CGFloat {
        switch size {
        case .small: return 2
        case .medium: return 3
        }
    }

    // MARK: - Colors

    static func colorsForTheme(_ theme: ColorTheme) -> ProgressColors {
        switch theme {
        case .light:
            return ProgressColors(
                low: Color(red: 0.2, green: 0.7, blue: 0.3),
                medium: Color(red: 0.9, green: 0.8, blue: 0.1),
                high: Color(red: 0.95, green: 0.6, blue: 0.1),
                critical: Color(red: 0.9, green: 0.2, blue: 0.2)
            )
        case .dark:
            return ProgressColors(
                low: Color(red: 0.3, green: 0.85, blue: 0.4),
                medium: Color(red: 1.0, green: 0.9, blue: 0.3),
                high: Color(red: 1.0, green: 0.7, blue: 0.2),
                critical: Color(red: 1.0, green: 0.3, blue: 0.3)
            )
        case .auto:
            return ProgressColors(
                low: .green,
                medium: .yellow,
                high: .orange,
                critical: .red
            )
        }
    }

    static var progressBarBackgroundColor: Color {
        Color.gray.opacity(0.2)
    }
}

// MARK: - Color Theme

enum ColorTheme: String {
    case light = "light"
    case dark = "dark"
    case auto = "auto"
}
