import SwiftUI

// MARK: - ProgressConfigViewModel

class ProgressConfigViewModel: ObservableObject {
    @Published var lowThreshold: Double = 60
    @Published var mediumThreshold: Double = 85
    @Published var showProgressBars: Bool = true
    @Published var lowColor: Color = .green
    @Published var mediumColor: Color = .orange
    @Published var highColor: Color = .red
    @Published var validationError: String?
    @Published var syncStatus: ConfigSyncStatus = .idle

    private let configService: ConfigurationService

    enum ConfigSyncStatus: Equatable {
        case idle
        case saving
        case saved
        case error(String)
    }

    init(configService: ConfigurationService = ConfigurationService()) {
        self.configService = configService
        loadConfig()
    }

    /// Loads the current configuration from iCloud.
    func loadConfig() {
        let config = configService.loadProgressConfig()
        lowThreshold = config.threshold1
        mediumThreshold = config.threshold2
        showProgressBars = configService.loadShowProgressBars()
    }

    /// Validates the current thresholds and returns a preview ProgressBarState.
    /// Throws ProgressConfigurationError when mediumThreshold <= lowThreshold.
    func validateAndPreview(config: ProgressBarConfig) -> ProgressBarState {
        validationError = nil

        guard config.threshold1 >= 0, config.threshold2 >= 0 else {
            validationError = "Threshold values must be non-negative"
            return defaultPreviewState()
        }

        guard config.threshold1 < config.threshold2 else {
            validationError = "Low threshold must be less than medium threshold"
            return defaultPreviewState()
        }

        // Generate preview state at 50% usage
        let previewPercentage = 50.0
        let threshold: String
        let color: Color

        if previewPercentage < config.threshold1 {
            threshold = "low"
            color = config.colors.low
        } else if previewPercentage < config.threshold2 {
            threshold = "medium"
            color = config.colors.medium
        } else {
            threshold = "high"
            color = config.colors.high
        }

        return ProgressBarState(
            value: previewPercentage,
            percentage: previewPercentage,
            color: color,
            threshold: threshold
        )
    }

    /// Saves the current configuration to iCloud.
    func saveConfig() {
        let config = buildCurrentConfig()

        let preview = validateAndPreview(config: config)
        guard validationError == nil else { return }

        syncStatus = .saving
        configService.saveProgressConfig(config: config)
        configService.saveShowProgressBars(showProgressBars)
        syncStatus = .saved

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            if self?.syncStatus == .saved {
                self?.syncStatus = .idle
            }
        }
    }

    /// Builds a ProgressBarConfig from the current view model state.
    func buildCurrentConfig() -> ProgressBarConfig {
        return ProgressBarConfig(
            value: 0,
            threshold1: lowThreshold,
            threshold2: mediumThreshold,
            colors: ProgressColors(
                low: lowColor,
                medium: mediumColor,
                high: highColor,
                background: Color(.systemGray5)
            )
        )
    }

    /// Returns a preview ProgressBarState reflecting the current settings.
    var previewState: ProgressBarState {
        return validateAndPreview(config: buildCurrentConfig())
    }

    private func defaultPreviewState() -> ProgressBarState {
        return ProgressBarState(
            value: 0,
            percentage: 0,
            color: .gray,
            threshold: "low"
        )
    }
}

// MARK: - ProgressBarState for Preview

struct ProgressBarState: Equatable {
    let value: Double
    let percentage: Double
    let color: Color
    let threshold: String
}

// MARK: - ProgressConfigView

struct ProgressConfigView: View {
    @StateObject private var viewModel = ProgressConfigViewModel()

    var body: some View {
        NavigationView {
            Form {
                enableSection
                thresholdSection
                colorSection
                previewSection
                saveSection
            }
            .navigationTitle("Progress Bar Settings")
        }
    }

    // MARK: - Enable/Disable Toggle

    private var enableSection: some View {
        Section {
            Toggle("Show Progress Bars in Widgets", isOn: $viewModel.showProgressBars)
                .accessibilityLabel("Toggle progress bars")
        } header: {
            Text("Display")
        }
    }

    // MARK: - Threshold Sliders

    private var thresholdSection: some View {
        Section {
            VStack(alignment: .leading) {
                Text("Low Threshold: \(Int(viewModel.lowThreshold))%")
                    .font(.body)
                Slider(value: $viewModel.lowThreshold, in: 0...100, step: 1)
                    .accessibilityLabel("Low threshold slider")
                    .accessibilityValue("\(Int(viewModel.lowThreshold)) percent")
            }

            VStack(alignment: .leading) {
                Text("Medium Threshold: \(Int(viewModel.mediumThreshold))%")
                    .font(.body)
                Slider(value: $viewModel.mediumThreshold, in: 0...100, step: 1)
                    .accessibilityLabel("Medium threshold slider")
                    .accessibilityValue("\(Int(viewModel.mediumThreshold)) percent")
            }

            if let error = viewModel.validationError {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .accessibilityLabel("Validation error: \(error)")
            }
        } header: {
            Text("Thresholds")
        } footer: {
            Text("Low threshold must be less than medium threshold. Usage above medium is considered high.")
        }
    }

    // MARK: - Color Pickers

    private var colorSection: some View {
        Section {
            ColorPickerRow(label: "Low Usage Color", color: $viewModel.lowColor)
            ColorPickerRow(label: "Medium Usage Color", color: $viewModel.mediumColor)
            ColorPickerRow(label: "High Usage Color", color: $viewModel.highColor)
        } header: {
            Text("Colors")
        }
    }

    // MARK: - Preview

    private var previewSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text("Preview")
                    .font(.headline)

                ProgressBarView(config: ProgressBarConfig(
                    value: viewModel.previewState.percentage,
                    threshold1: viewModel.lowThreshold,
                    threshold2: viewModel.mediumThreshold,
                    colors: ProgressColors(
                        low: viewModel.lowColor,
                        medium: viewModel.mediumColor,
                        high: viewModel.highColor,
                        background: Color(.systemGray5)
                    )
                ))
                .frame(height: 12)
                .accessibilityLabel("Progress bar preview")

                Text("Current threshold: \(viewModel.previewState.threshold)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 8)
        } header: {
            Text("Live Preview")
        } footer: {
            Text("Preview updates in real-time as you adjust settings.")
        }
    }

    // MARK: - Save Button

    private var saveSection: some View {
        Section {
            Button(action: viewModel.saveConfig) {
                HStack {
                    Image(systemName: "icloud.and.arrow.up")
                    Text("Save & Sync to iCloud")
                }
            }
            .disabled(viewModel.validationError != nil || viewModel.syncStatus == .saving)

            syncStatusRow
        } header: {
            Text("Actions")
        }
    }

    @ViewBuilder
    private var syncStatusRow: some View {
        switch viewModel.syncStatus {
        case .idle:
            EmptyView()
        case .saving:
            HStack {
                ProgressView()
                    .scaleEffect(0.8)
                Text("Syncing...")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        case .saved:
            HStack {
                Image(systemName: "checkmark.icloud")
                    .foregroundColor(.green)
                Text("Saved to iCloud")
                    .font(.caption)
                    .foregroundColor(.green)
            }
        case .error(let message):
            HStack {
                Image(systemName: "exclamationmark.icloud")
                    .foregroundColor(.red)
                Text(message)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
    }
}

#if DEBUG
struct ProgressConfigView_Previews: PreviewProvider {
    static var previews: some View {
        ProgressConfigView()
    }
}
#endif
