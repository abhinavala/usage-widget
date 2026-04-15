import Foundation
import Combine

class ConfigurationService: ObservableObject {

    // MARK: - Keys

    private enum Keys {
        static let fetchInterval = "config.fetchInterval"
        static let staleThreshold = "config.staleThreshold"
        static let autoFetch = "config.autoFetch"
        static let selectedFetcher = "config.selectedFetcher"
    }

    // MARK: - Defaults

    static let defaultFetchInterval: Int = 300
    static let defaultStaleThreshold: Int = 600
    static let defaultAutoFetch: Bool = true
    static let defaultSelectedFetcher: String = "webapi"

    // MARK: - Published Properties

    @Published var fetchInterval: Int {
        didSet { defaults.set(fetchInterval, forKey: Keys.fetchInterval) }
    }

    @Published var staleThreshold: Int {
        didSet { defaults.set(staleThreshold, forKey: Keys.staleThreshold) }
    }

    @Published var autoFetch: Bool {
        didSet { defaults.set(autoFetch, forKey: Keys.autoFetch) }
    }

    @Published var selectedFetcher: String {
        didSet { defaults.set(selectedFetcher, forKey: Keys.selectedFetcher) }
    }

    // MARK: - Private

    private let defaults: UserDefaults

    // MARK: - Init

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        self.fetchInterval = defaults.object(forKey: Keys.fetchInterval) as? Int
            ?? ConfigurationService.defaultFetchInterval

        self.staleThreshold = defaults.object(forKey: Keys.staleThreshold) as? Int
            ?? ConfigurationService.defaultStaleThreshold

        self.autoFetch = defaults.object(forKey: Keys.autoFetch) as? Bool
            ?? ConfigurationService.defaultAutoFetch

        self.selectedFetcher = defaults.string(forKey: Keys.selectedFetcher)
            ?? ConfigurationService.defaultSelectedFetcher
    }

    // MARK: - Actions

    func resetToDefaults() {
        fetchInterval = ConfigurationService.defaultFetchInterval
        staleThreshold = ConfigurationService.defaultStaleThreshold
        autoFetch = ConfigurationService.defaultAutoFetch
        selectedFetcher = ConfigurationService.defaultSelectedFetcher
    }

    var fetchIntervalTimeInterval: TimeInterval {
        return TimeInterval(fetchInterval)
    }

    var staleThresholdTimeInterval: TimeInterval {
        return TimeInterval(staleThreshold)
    }
}
