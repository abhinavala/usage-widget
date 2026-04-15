import SwiftUI

struct ConflictResolutionView: View {
    let onKeepOverride: () -> Void
    let onAcceptFetched: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                conflictHeader
                optionCards
                Spacer()
            }
            .padding()
            .navigationTitle("Sync Conflict")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var conflictHeader: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text("Data Conflict Detected")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Your manual overrides conflict with newly fetched data from another device. Choose which data to keep.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }

    private var optionCards: some View {
        VStack(spacing: 16) {
            Button(action: onKeepOverride) {
                ConflictOptionCard(
                    title: "Keep Manual Overrides",
                    description: "Continue using your manually set values. Fetched data will be ignored until the override expires.",
                    iconName: "hand.raised.fill",
                    accentColor: .orange
                )
            }
            .buttonStyle(.plain)

            Button(action: onAcceptFetched) {
                ConflictOptionCard(
                    title: "Accept Fetched Data",
                    description: "Discard your manual overrides and use the latest automatically fetched usage data.",
                    iconName: "arrow.clockwise.icloud.fill",
                    accentColor: .blue
                )
            }
            .buttonStyle(.plain)
        }
    }
}

private struct ConflictOptionCard: View {
    let title: String
    let description: String
    let iconName: String
    let accentColor: Color

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: iconName)
                .font(.title2)
                .foregroundColor(accentColor)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
                .font(.caption)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
        )
    }
}

#if DEBUG
struct ConflictResolutionView_Previews: PreviewProvider {
    static var previews: some View {
        ConflictResolutionView(
            onKeepOverride: {},
            onAcceptFetched: {}
        )
    }
}
#endif
