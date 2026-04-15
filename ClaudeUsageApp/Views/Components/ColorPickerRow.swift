import SwiftUI

struct ColorPickerRow: View {
    let title: String
    @Binding var selectedColor: Color

    var body: some View {
        HStack {
            Text(title)
                .font(.body)

            Spacer()

            ColorPicker("", selection: $selectedColor, supportsOpacity: false)
                .labelsHidden()
                .accessibilityLabel("\(title) color picker")
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    List {
        ColorPickerRow(title: "Low Usage", selectedColor: .constant(.green))
        ColorPickerRow(title: "Medium Usage", selectedColor: .constant(.orange))
        ColorPickerRow(title: "High Usage", selectedColor: .constant(.red))
    }
}
