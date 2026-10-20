// Service Ceo home-screen widget for iPhone.
// Tapping it opens the app's Quick hours screen with the scanner ready.
import SwiftUI
import WidgetKit

struct QuickHoursEntry: TimelineEntry {
  let date: Date
}

struct QuickHoursProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickHoursEntry { QuickHoursEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (QuickHoursEntry) -> Void) {
    completion(QuickHoursEntry(date: Date()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<QuickHoursEntry>) -> Void) {
    completion(Timeline(entries: [QuickHoursEntry(date: Date())], policy: .never))
  }
}

private let accent = Color(red: 1.0, green: 0.69, blue: 0.125)
private let background = Color(red: 0.094, green: 0.106, blue: 0.125)

struct QuickHoursView: View {
  @Environment(\.widgetFamily) var family
  var entry: QuickHoursEntry

  var content: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Image(systemName: "wrench.fill").font(.system(size: 12, weight: .bold))
        Text("SERVICE CEO").font(.system(size: 12, weight: .heavy)).kerning(1)
      }
      .foregroundColor(accent)
      Spacer(minLength: 0)
      Image(systemName: "barcode.viewfinder")
        .font(.system(size: family == .systemSmall ? 34 : 40, weight: .semibold))
        .foregroundColor(.white)
      Text("SCAN & UPDATE")
        .font(.system(size: 15, weight: .heavy, design: .default))
        .foregroundColor(.white)
      Text("HOURS")
        .font(.system(size: 15, weight: .heavy))
        .foregroundColor(accent)
      if family != .systemSmall {
        Text("Find a machine, enter hours, see if service is due.")
          .font(.system(size: 12, weight: .light))
          .foregroundColor(Color.white.opacity(0.7))
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(URL(string: "serviceceo://quick?scan=1"))
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(background, for: .widget)
    } else {
      content.padding().background(background)
    }
  }
}

@main
struct ServiceCeoWidgetBundle: WidgetBundle {
  var body: some Widget {
    QuickHoursWidget()
  }
}

struct QuickHoursWidget: Widget {
  let kind = "QuickHours"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: QuickHoursProvider()) { entry in
      QuickHoursView(entry: entry)
    }
    .configurationDisplayName("Quick hours")
    .description("Scan a machine and update its hours.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
