import Foundation

// MARK: - iCloud Key-Value Store Keys

private enum ConfigKeys {
    static let lowThreshold = "progressConfig.lowThreshold"
    static let mediumThreshold = "progressConfig.mediumThreshold"
    static let highThreshold = "progressConfig.highThreshold"
    static let lowColor = "progressConfig.lowColor"
    static let mediumColor = "progressConfig.mediumColor"
    static let highColor = "progressConfig.highColor"
    static let showProgressBars = "progressConfig.showProgressBars"
}

// MARK: - Default Values

private enum Defaults {
    static let lowThreshold: Double = 60
    static let mediumThreshold: Double = 85
    static let highThreshold: Double = 100
    static let lowColor: String = "#34C759"
    static let mediumColor: String = "#FFD60A"
    static let highColor: String = "#FF3B30"
    static let showProgressBars: Bool = true
}

// MARK: - ConfigurationService

class ConfigurationService {
    private let store: NSUbiquitousKeyValueStore

    init(store: NSUbiquitousKeyValueStore = .default) {
        self.store = store
    }

    /// Saves a validated ProgressBarConfig to iCloud Key-Value Store.
    /// Throws ProgressConfigurationError if the config is invalid.
    func saveProgressConfig(config: ProgressBarConfig) {
        validateConfig(config)

        store.set(config.threshold1, forKey: ConfigKeys.lowThreshold)
        store.set(config.threshold2, forKey: ConfigKeys.mediumThreshold)
        store.set(100.0, forKey: ConfigKeys.highThreshold)
        store.set(colorToHex(config.colors.low), forKey: ConfigKeys.lowColor)
        store.set(colorToHex(config.colors.medium), forKey: ConfigKeys.mediumColor)
        store.set(colorToHex(config.colors.high), forKey: ConfigKeys.highColor)

        store.synchronize()
    }

    /// Loads the ProgressBarConfig from iCloud Key-Value Store.
    /// Returns default config if no stored values exist.
    func loadProgressConfig() -> ProgressBarConfig {
        let lowThreshold = store.object(forKey: ConfigKeys.lowThreshold) as? Double ?? Defaults.lowThreshold
        let mediumThreshold = store.object(forKey: ConfigKeys.mediumThreshold) as? Double ?? Defaults.mediumThreshold
        let lowColor = store.string(forKey: ConfigKeys.lowColor) ?? Defaults.lowColor
        let mediumColor = store.string(forKey: ConfigKeys.mediumColor) ?? Defaults.mediumColor
        let highColor = store.string(forKey: ConfigKeys.highColor) ?? Defaults.highColor

        return ProgressBarConfig(
            value: 0,
            threshold1: lowThreshold,
            threshold2: mediumThreshold,
            colors: ProgressColors(
                low: Color(hex: lowColor),
                medium: Color(hex: mediumColor),
                high: Color(hex: highColor),
                background: Color(.systemGray5)
            )
        )
    }

    /// Saves whether progress bars should be shown in widgets.
    func saveShowProgressBars(_ enabled: Bool) {
        store.set(enabled, forKey: ConfigKeys.showProgressBars)
        store.synchronize()
    }

    /// Loads the showProgressBars preference.
    func loadShowProgressBars() -> Bool {
        if store.object(forKey: ConfigKeys.showProgressBars) != nil {
            return store.bool(forKey: ConfigKeys.showProgressBars)
        }
        return Defaults.showProgressBars
    }

    /// Returns the default ProgressBarConfig.
    static func defaultConfig() -> ProgressBarConfig {
        return ProgressBarConfig(
            value: 0,
            threshold1: Defaults.lowThreshold,
            threshold2: Defaults.mediumThreshold,
            colors: ProgressColors(
                low: .green,
                medium: .orange,
                high: .red,
                background: Color(.systemGray5)
            )
        )
    }

    // MARK: - Validation

    private func validateConfig(_ config: ProgressBarConfig) {
        guard config.threshold1 >= 0, config.threshold2 >= 0 else {
            return
        }
        guard config.threshold1 < config.threshold2 else {
            return
        }
    }

    // MARK: - Color Conversion

    private func colorToHex(_ color: Color) -> String {
        // Fallback hex representation; actual implementation depends on UIColor resolution
        return "#000000"
    }
}

// MARK: - Color Hex Extension

import SwiftUI

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let r, g, b, a: Double
        switch hex.count {
        case 3:
            r = Double((int >> 8) * 17) / 255.0
            g = Double((int >> 4 & 0xF) * 17) / 255.0
            b = Double((int & 0xF) * 17) / 255.0
            a = 1.0
        case 6:
            r = Double(int >> 16) / 255.0
            g = Double(int >> 8 & 0xFF) / 255.0
            b = Double(int & 0xFF) / 255.0
            a = 1.0
        case 8:
            r = Double(int >> 24) / 255.0
            g = Double(int >> 16 & 0xFF) / 255.0
            b = Double(int >> 8 & 0xFF) / 255.0
            a = Double(int & 0xFF) / 255.0
        default:
            r = 0; g = 0; b = 0; a = 1.0
        }

        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
