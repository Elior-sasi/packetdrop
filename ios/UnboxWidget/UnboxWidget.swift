// Unbox widgets: home screen (small, medium) and lock screen (line above the clock, rectangle under it).
// They read the same personal widget address the Scriptable widget used, saved by the app in the shared app group,
// so nothing else needs to be set up: open the app once, then add the widget.
import WidgetKit
import SwiftUI

let GROUP = "group.com.eliorsasi.unbox"

struct Line: Decodable, Hashable { let t: String; let s: String; let c: String; let id: String? }
struct Lock: Decodable { let inline: String; let rect: [String] }
struct Top: Decodable { let done: Int; let img: String }
struct Payload: Decodable { let ok: Bool; let lines: [Line]?; let lock: Lock?; let top: Top? }

struct Entry: TimelineEntry {
    let date: Date
    let lines: [Line]
    let lock: Lock?
    let done: Int
    let photo: UIImage?
    let state: State
    enum State { case ok, noLink, offline }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry {
        Entry(date: .now, lines: [Line(t: "מחר", s: "big", c: "teal", id: nil), Line(t: "אוזניות אלחוטיות", s: "title", c: "white", id: nil), Line(t: "3 בדרך · AliExpress", s: "small", c: "gray", id: nil)], lock: Lock(inline: "📦 אוזניות מחר", rect: ["אוזניות", "מחר"]), done: 3, photo: nil, state: .ok)
    }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        if context.isPreview { return completion(placeholder(in: context)) }
        load(withPhoto: context.family == .systemMedium, completion: completion)
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        load(withPhoto: context.family == .systemMedium) { e in
            // Every 30 minutes; iOS may stretch it. The app also asks for a refresh when it opens.
            completion(Timeline(entries: [e], policy: .after(Date().addingTimeInterval(30 * 60))))
        }
    }
    private func load(withPhoto: Bool, completion: @escaping (Entry) -> Void) {
        guard let s = UserDefaults(suiteName: GROUP)?.string(forKey: "widgetURL"), let url = URL(string: s) else {
            return completion(Entry(date: .now, lines: [], lock: nil, done: 0, photo: nil, state: .noLink))
        }
        var req = URLRequest(url: url); req.cachePolicy = .reloadIgnoringLocalCacheData; req.timeoutInterval = 15
        URLSession.shared.dataTask(with: req) { data, _, _ in
            guard let data, let p = try? JSONDecoder().decode(Payload.self, from: data), p.ok else {
                return completion(Entry(date: .now, lines: [], lock: nil, done: 0, photo: nil, state: .offline))
            }
            var photo: UIImage? = nil
            if withPhoto, let u = p.top?.img, let iu = URL(string: u), let d = try? Data(contentsOf: iu), let img = UIImage(data: d) {
                photo = img.preparingThumbnail(of: CGSize(width: 240, height: 240)) ?? img
            }
            completion(Entry(date: .now, lines: p.lines ?? [], lock: p.lock, done: p.top?.done ?? 0, photo: photo, state: .ok))
        }.resume()
    }
}

extension Line {
    var color: Color {
        switch c {
        case "teal": return Color(red: 0.18, green: 0.83, blue: 0.78)
        case "red": return Color(red: 1, green: 0.42, blue: 0.42)
        case "light": return Color.white.opacity(0.85)
        case "gray": return Color.white.opacity(0.6)
        default: return .white
        }
    }
    var font: Font {
        switch s {
        case "big": return .system(size: 22, weight: .heavy)
        case "title": return .system(size: 15, weight: .bold)
        case "mid": return .system(size: 13, weight: .semibold)
        default: return .system(size: 12, weight: .medium)
        }
    }
}

struct Bar: View {
    let done: Int
    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<5, id: \.self) { i in
                Capsule().fill(i < done ? Color(red: 0.29, green: 0.66, blue: 1) : Color.white.opacity(0.18)).frame(height: 4)
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .accessibilityHidden(true)
    }
}

struct HomeView: View {
    let e: Entry
    let medium: Bool
    var body: some View {
        if e.state != .ok || e.lines.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Unbox").font(.system(size: 15, weight: .heavy)).foregroundStyle(.white)
                Text(e.state == .noLink ? "פתח את Unbox פעם אחת כדי לחבר את הווידג׳ט" : e.state == .offline ? "אין חיבור כרגע" : "אין חבילות בדרך")
                    .font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.7))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(Array(e.lines.prefix(medium ? 4 : 3).enumerated()), id: \.offset) { _, l in
                        Text(l.t).font(l.font).foregroundStyle(l.color).lineLimit(l.s == "title" ? 2 : 1).minimumScaleFactor(0.7)
                    }
                    Spacer(minLength: 0)
                    if e.done > 0 { Bar(done: e.done) }
                }
                if medium, let p = e.photo {
                    Image(uiImage: p).resizable().scaledToFill().frame(width: 96, height: 96).clipShape(RoundedRectangle(cornerRadius: 16)).accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .widgetURL(e.lines.first(where: { $0.id != nil })?.id.flatMap { URL(string: "unbox://open?p=" + ($0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")) })
        }
    }
}

struct LockView: View {
    let e: Entry
    let family: WidgetFamily
    var body: some View {
        switch family {
        case .accessoryInline:
            Text(e.lock?.inline ?? "Unbox")
        default:
            VStack(alignment: .leading, spacing: 1) {
                ForEach(Array((e.lock?.rect ?? ["Unbox", e.state == .noLink ? "פתח את האפליקציה" : "אין חבילות בדרך"]).prefix(3).enumerated()), id: \.offset) { i, t in
                    Text(t).font(i == 0 ? .headline : .caption).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct EntryView: View {
    @Environment(\.widgetFamily) var family
    let e: Entry
    var body: some View {
        Group {
            switch family {
            case .accessoryInline, .accessoryRectangular: LockView(e: e, family: family)
            default: HomeView(e: e, medium: family == .systemMedium)
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .containerBackground(for: .widget) {
            LinearGradient(colors: [Color(red: 0.086, green: 0.192, blue: 0.302), Color(red: 0.055, green: 0.165, blue: 0.2), Color(red: 0.04, green: 0.078, blue: 0.094)], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

@main
struct UnboxWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "UnboxWidget", provider: Provider()) { EntryView(e: $0) }
            .configurationDisplayName("Unbox")
            .description("החבילה הבאה שמגיעה, ומה שמחכה לאיסוף.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryInline, .accessoryRectangular])
    }
}
