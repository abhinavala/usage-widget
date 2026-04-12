import SwiftUI
import Combine

struct ManualOverrideData: Identifiable {
    let id = UUID()
    var tokensUsed: Double?
    var tokensLimit: Double?
    var requestsUsed: Double?
    var requestsLimit: Double?
    var isActive: Bool
    var expiresAt: Date

    var isExpired: Bool {
        expiresAt < Date()
    }
}

enum OverrideSyncStatus: Equatable {
    case idle
    case syncing
    case success
    case error(String)
}

class ManualOverrideViewModel: ObservableObject {
    @Published var tokensUsed: Double = 0
    @Published var tokensLimit: Double = 100000
    @Published var requestsUsed: Double = 0
    @Published var requestsLimit: Double = 1000
    @Published var isActive: Bool = false
    @Published var syncStatus: OverrideSyncStatus = .idle
    @Published var expiresAt: Date = Date().addingTimeInterval(3600)
    @Published var hasConflict: Bool = false

    var isExpired: Bool {
        expiresAt < Date()
    }

    func saveOverride() {
        guard !isExpired else { return }
        syncStatus = .syncing
        isActive = true

        // Simulate async sync to iCloud via CloudSyncManager
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self else { return }
            self.syncStatus = .success

            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                if self?.syncStatus == .success {
                    self?.syncStatus = .idle
                }
            }
        }
    }

    func clearOverride() {
        isActive = false
        tokensUsed = 0
        tokensLimit = 100000
        requestsUsed = 0
        requestsLimit = 1000
        syncStatus = .idle
        hasConflict = false
    }
}

struct ManualOverrideView: View {
    @StateObject private var viewModel = ManualOverrideViewModel()
    @State private var showConflictResolution = false

    var body: some View {
        NavigationView {
            Form {
                syncStatusSection
                tokenOverrideSection
                requestOverrideSection
                overrideControlSection
            }
            .navigationTitle("Manual Overrides")
            .sheet(isPresented: $showConflictResolution) {
                ConflictResolutionView(
                    onKeepOverride: {
                        viewModel.hasConflict = false
                        showConflictResolution = false
                    },
                    onAcceptFetched: {
                        viewModel.clearOverride()
                        showConflictResolution = false
                    }
                )
            }
            .onChange(of: viewModel.hasConflict) { hasConflict in
                if hasConflict {
                    showConflictResolution = true
                }
            }
        }
    }

    private var syncStatusSection: some View {
        Section {
            HStack {
                Text("Sync Status")
                Spacer()
                syncStatusIndicator
            }

            if viewModel.isActive {
                HStack {
                    Text("Override Active")
                        .foregroundColor(.orange)
                    Spacer()
                    if viewModel.isExpired {
                        Text("Expired")
                            .foregroundColor(.red)
                            .font(.caption)
                    } else {
                        Text("Expires \(viewModel.expiresAt, style: .relative)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        } header: {
            Text("Status")
        }
    }

    @ViewBuilder
    private var syncStatusIndicator: some View {
        switch viewModel.syncStatus {
        case .idle:
            Image(systemName: "cloud")
                .foregroundColor(.secondary)
        case .syncing:
            ProgressView()
                .scaleEffect(0.8)
        case .success:
            Image(systemName: "checkmark.icloud")
                .foregroundColor(.green)
        case .error(let message):
            Label(message, systemImage: "exclamationmark.icloud")
                .foregroundColor(.red)
                .font(.caption)
        }
    }

    private var tokenOverrideSection: some View {
        Section {
            VStack(alignment: .leading) {
                Text("Tokens Used: \(Int(viewModel.tokensUsed))")
                Slider(value: $viewModel.tokensUsed, in: 0...viewModel.tokensLimit, step: 1000)
            }

            VStack(alignment: .leading) {
                Text("Tokens Limit: \(Int(viewModel.tokensLimit))")
                Slider(value: $viewModel.tokensLimit, in: 0...500000, step: 5000)
            }
        } header: {
            Text("Token Overrides")
        }
    }

    private var requestOverrideSection: some View {
        Section {
            VStack(alignment: .leading) {
                Text("Requests Used: \(Int(viewModel.requestsUsed))")
                Slider(value: $viewModel.requestsUsed, in: 0...viewModel.requestsLimit, step: 10)
            }

            VStack(alignment: .leading) {
                Text("Requests Limit: \(Int(viewModel.requestsLimit))")
                Slider(value: $viewModel.requestsLimit, in: 0...10000, step: 100)
            }
        } header: {
            Text("Request Overrides")
        }
    }

    private var overrideControlSection: some View {
        Section {
            Button(action: viewModel.saveOverride) {
                HStack {
                    Image(systemName: "icloud.and.arrow.up")
                    Text("Save & Sync Override")
                }
            }
            .disabled(viewModel.syncStatus == .syncing || viewModel.isExpired)

            if viewModel.isActive {
                Button(role: .destructive, action: viewModel.clearOverride) {
                    HStack {
                        Image(systemName: "xmark.circle")
                        Text("Clear Override")
                    }
                }
            }
        } header: {
            Text("Actions")
        }
    }
}

#if DEBUG
struct ManualOverrideView_Previews: PreviewProvider {
    static var previews: some View {
        ManualOverrideView()
    }
}
#endif
