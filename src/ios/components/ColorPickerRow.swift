import SwiftUI

/// A reusable row component that displays a label and a color picker.
/// Used in ProgressConfigView for selecting threshold colors.
struct ColorPickerRow: View {
    let label: String
    @Binding var color: Color

    var body: some View {
        HStack {
            Text(label)
                .font(.body)
            Spacer()
            ColorPicker("", selection: $color, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 44, height: 44)
                .accessibilityLabel("\(label) color picker")
        }
        .padding(.vertical, 4)
    }
}

#if DEBUG
struct ColorPickerRow_Previews: PreviewProvider {
    @State static var color: Color = .green

    static var previews: some View {
        Form {
            ColorPickerRow(label: "Low Usage", color: $color)
        }
    }
}
#endif
