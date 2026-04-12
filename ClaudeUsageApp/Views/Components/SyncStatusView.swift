import SwiftUI

/// Displays the current iCloud sync status with last sync timestamp
/// and provides troubleshooting guidance for error states.
struct SyncStatusView: View {
    @ObservedObject var settingsManager: SettingsManager

    private var statusIcon: String {
        switch settingsManager.syncStatus {
        case .synced:
            return "checkmark.icloud.fill"
        case .syncing:
            return "arrow.triangle.2.circlepath.icloud.fill"
        case .error:
            return "exclamationmark.icloud.fill"
        case .offline:
            return "icloud.slash.fill"
        }
    }

    private var statusColor: Color {
        switch settingsManager.syncStatus {
        case .synced:
            return .green
        case .syncing:
            return .blue
        case .error:
            return .red
        case .offline:
            return .gray
        }
    }

    private var statusText: String {
        switch settingsManager.syncStatus {
        case .synced:
            return "Synced"
        case .syncing:
            return "Syncing…"
        case .error:
            return "Sync Error"
        case .offline:
            return "Offline"
        }
    }

    private var statusDescription: String {
        switch settingsManager.syncStatus {
        case .synced:
            return "All data is up to date with iCloud."
        case .syncing:
            return "Syncing data with iCloud…"
        case .error:
            return "Unable to sync. Check your iCloud settings and network connection."
        case .offline:
            return "No network connection. Changes will sync when you're back online."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: statusIcon)
                    .font(.title2)
                    .foregroundStyle(statusColor)
                    .symbolEffect(.pulse, isActive: settingsManager.syncStatus == .syncing)

                VStack(alignment: .leading, spacing: 2) {
                    Text(statusText)
                        .font(.headline)

                    Text(statusDescription)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            if let lastSync = settingsManager.lastSyncTimestamp {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text("Last synced: \(lastSync, style: .relative) ago")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if settingsManager.syncStatus == .error {
                Button(action: {
                    settingsManager.triggerManualSync { _ in }
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Retry Sync")
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Sync status: \(statusText)")
    }
}

#Preview {
    SyncStatusView(settingsManager: SettingsManager())
        .padding()
}
