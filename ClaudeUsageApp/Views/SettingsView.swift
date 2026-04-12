import SwiftUI

/// Comprehensive settings interface for configuring override behavior,
/// viewing sync status, managing data preferences, and troubleshooting.
struct SettingsView: View {
    @StateObject private var settingsManager = SettingsManager()
    @State private var showResetConfirmation = false
    @State private var showClearOverrideConfirmation = false
    @State private var syncTriggered = false

    private let expirationOptions: [(label: String, minutes: Int)] = [
        ("1 hour", 60),
        ("6 hours", 360),
        ("12 hours", 720),
        ("24 hours", 1440),
        ("48 hours", 2880)
    ]

    private let refreshIntervalOptions: [(label: String, minutes: Int)] = [
        ("5 minutes", 5),
        ("15 minutes", 15),
        ("30 minutes", 30),
        ("60 minutes", 60)
    ]

    private let dataSourceOptions: [(label: String, value: String)] = [
        ("Web API", "webapi"),
        ("CLI", "cli"),
        ("Cache", "cache")
    ]

    private let colorThemeOptions: [(label: String, value: String)] = [
        ("Light", "light"),
        ("Dark", "dark"),
        ("Auto", "auto")
    ]

    var body: some View {
        List {
            syncStatusSection
            overrideBehaviorSection
            widgetAppearanceSection
            dataPreferencesSection
            troubleshootingSection
        }
        .navigationTitle("Settings")
        .alert("Reset All Settings", isPresented: $showResetConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                settingsManager.resetToDefaults()
            }
        } message: {
            Text("This will reset all settings to their default values. This cannot be undone.")
        }
        .alert("Clear Override Data", isPresented: $showClearOverrideConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Clear", role: .destructive) {
                settingsManager.clearAllOverrideData()
            }
        } message: {
            Text("This will clear all manual override data and revert to real usage values.")
        }
    }

    // MARK: - Sync Status Section

    private var syncStatusSection: some View {
        Section {
            SyncStatusView(settingsManager: settingsManager)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
        } header: {
            Text("Sync Status")
        } footer: {
            Text("Shows the current sync status between this device and your Mac app via iCloud.")
        }
    }

    // MARK: - Override Behavior Section

    private var overrideBehaviorSection: some View {
        Section {
            Picker("Override Expiration", selection: $settingsManager.overrideExpirationMinutes) {
                ForEach(expirationOptions, id: \.minutes) { option in
                    Text(option.label).tag(option.minutes)
                }
            }
            .accessibilityLabel("Override expiration time")
            .accessibilityHint("How long manual overrides stay active before reverting to real data")
        } header: {
            Text("Override Behavior")
        } footer: {
            Text("Controls how long manual override values remain active before automatically reverting to real usage data.")
        }
    }

    // MARK: - Widget Appearance Section

    private var widgetAppearanceSection: some View {
        Section {
            Toggle("Show Reset Time", isOn: $settingsManager.showResetTime)
                .accessibilityLabel("Show reset time in widget")
                .accessibilityHint("Displays when usage counters will reset")

            Picker("Color Theme", selection: $settingsManager.colorTheme) {
                ForEach(colorThemeOptions, id: \.value) { option in
                    Text(option.label).tag(option.value)
                }
            }
            .accessibilityLabel("Widget color theme")

            Picker("Refresh Interval", selection: $settingsManager.widgetRefreshIntervalMinutes) {
                ForEach(refreshIntervalOptions, id: \.minutes) { option in
                    Text(option.label).tag(option.minutes)
                }
            }
            .accessibilityLabel("Widget refresh interval")
            .accessibilityHint("How often the widget refreshes its data")
        } header: {
            Text("Widget Appearance")
        } footer: {
            Text("These preferences sync across all your devices via iCloud.")
        }
    }

    // MARK: - Data Preferences Section

    private var dataPreferencesSection: some View {
        Section {
            Picker("Data Source Priority", selection: $settingsManager.dataSourcePriority) {
                ForEach(dataSourceOptions, id: \.value) { option in
                    Text(option.label).tag(option.value)
                }
            }
            .accessibilityLabel("Preferred data source")
            .accessibilityHint("Which source to prioritize when fetching usage data")
        } header: {
            Text("Data Preferences")
        } footer: {
            Text("Controls which data source is preferred when multiple are available.")
        }
    }

    // MARK: - Troubleshooting Section

    private var troubleshootingSection: some View {
        Section {
            Button(action: {
                syncTriggered = true
                settingsManager.triggerManualSync { _ in
                    syncTriggered = false
                }
            }) {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Sync Now")
                    Spacer()
                    if syncTriggered {
                        ProgressView()
                    }
                }
            }
            .disabled(syncTriggered)
            .accessibilityLabel("Trigger manual sync")
            .accessibilityHint("Forces an immediate iCloud sync operation")

            Button(role: .destructive, action: {
                showClearOverrideConfirmation = true
            }) {
                HStack {
                    Image(systemName: "slider.horizontal.2.gobackward")
                    Text("Clear All Override Data")
                }
            }
            .accessibilityLabel("Clear all override data")
            .accessibilityHint("Removes all manual overrides and reverts to real data")

            Button(role: .destructive, action: {
                showResetConfirmation = true
            }) {
                HStack {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Reset All Settings")
                }
            }
            .accessibilityLabel("Reset all settings to defaults")
        } header: {
            Text("Troubleshooting")
        } footer: {
            Text("Use these tools to diagnose and fix sync issues or reset the app to a clean state.")
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}
