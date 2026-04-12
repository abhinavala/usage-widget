import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.blue)

                Text("Claude Usage")
                    .font(.title)
                    .fontWeight(.bold)

                Text("Manual Override Controls")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("Claude Usage")
        }
    }
}

#Preview {
    ContentView()
}
