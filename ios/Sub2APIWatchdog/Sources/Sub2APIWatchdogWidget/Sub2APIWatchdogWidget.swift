import SwiftUI
import WidgetKit
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

struct WatchdogWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let preferences: UiPreferences
}

struct WatchdogWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchdogWidgetEntry {
        WatchdogWidgetEntry(date: Date(), snapshot: sampleSnapshot, preferences: UiPreferences())
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchdogWidgetEntry) -> Void) {
        completion(entry(snapshot: WidgetSnapshotStore.load() ?? sampleSnapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchdogWidgetEntry>) -> Void) {
        completion(Timeline(entries: [entry(snapshot: WidgetSnapshotStore.load())], policy: .after(Date().addingTimeInterval(15 * 60))))
    }

    private func entry(snapshot: WidgetSnapshot?) -> WatchdogWidgetEntry {
        WatchdogWidgetEntry(date: Date(), snapshot: snapshot, preferences: UiPreferencesStore.load())
    }

    private var sampleSnapshot: WidgetSnapshot {
        WidgetSnapshot(
            updatedAt: Date(),
            accounts: [
                WidgetSnapshotAccount(id: 1, name: "openai-main", platform: "openai", session: 0.42, weekly: 0.18),
                WidgetSnapshotAccount(id: 2, name: "claude-backup", platform: "anthropic", session: 0.68, weekly: 0.36)
            ],
            todayTokens: "1.2M",
            todayRequests: "128",
            todayCost: "$2.40",
            normalAccounts: "2"
        )
    }
}

struct Sub2APIWatchdogWidgetView: View {
    let entry: WatchdogWidgetEntry
    @Environment(\.widgetFamily) private var family

    private var palette: WidgetPalette { WidgetPalette(entry.preferences) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Sub2API")
                    .font(.headline.weight(.black))
                    .foregroundStyle(palette.text)
                Spacer()
                Text(entry.snapshot == nil ? "打开 App" : "Active")
                    .font(.caption2.weight(.black))
                    .foregroundStyle(palette.muted)
            }

            if let snapshot = entry.snapshot, !snapshot.accounts.isEmpty {
                switch entry.preferences.widgetStyle {
                case .rings:
                    ringStack(snapshot.accounts)
                case .segments:
                    segmentList(snapshot)
                case .spotlight:
                    spotlight(snapshot)
                }
            } else {
                emptyState
            }

            Text(entry.snapshot?.updatedAt ?? entry.date, style: .time)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(palette.muted)
        }
        .containerBackground(palette.background, for: .widget)
    }

    private func ringStack(_ accounts: [WidgetSnapshotAccount]) -> some View {
        HStack(spacing: 8) {
            ForEach(accounts.prefix(family == .systemSmall ? 3 : 5)) { account in
                UsageRing(account: account, size: family == .systemSmall ? 42 : 36, palette: palette)
            }
        }
    }

    private func segmentList(_ snapshot: WidgetSnapshot) -> some View {
        VStack(spacing: 8) {
            metricRow(snapshot)
            ForEach(snapshot.accounts.prefix(3)) { account in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(account.name)
                            .font(.caption.weight(.black))
                            .foregroundStyle(palette.text)
                            .lineLimit(1)
                        Spacer()
                        Text(percent(account.session))
                            .font(.caption.monospacedDigit().weight(.black))
                            .foregroundStyle(color(account.session))
                    }
                    pairedBars(account)
                }
            }
        }
    }

    private func spotlight(_ snapshot: WidgetSnapshot) -> some View {
        let account = snapshot.accounts[0]
        return VStack(alignment: .leading, spacing: 8) {
            metricRow(snapshot)
            HStack(spacing: 9) {
                UsageRing(account: account, size: 42, palette: palette)
                VStack(alignment: .leading, spacing: 5) {
                    Text(account.name)
                        .font(.caption.weight(.black))
                        .foregroundStyle(palette.text)
                        .lineLimit(1)
                    HStack {
                        Text("会话")
                        Spacer()
                        Text(percent(account.session))
                            .foregroundStyle(color(account.session))
                    }
                    .font(.caption2.weight(.bold))
                    pairedBars(account)
                }
            }
        }
    }

    private func pairedBars(_ account: WidgetSnapshotAccount) -> some View {
        VStack(spacing: 3) {
            bar(account.session)
            bar(account.weekly)
        }
    }

    private func bar(_ value: Double) -> some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(palette.track)
                Capsule()
                    .fill(color(value))
                    .frame(width: proxy.size.width * min(1, max(0, value)))
            }
        }
        .frame(height: 6)
    }

    private func metricRow(_ snapshot: WidgetSnapshot) -> some View {
        HStack(spacing: 8) {
            miniMetric(snapshot.todayTokens, "tokens")
            miniMetric(snapshot.todayRequests, "req")
            miniMetric(snapshot.normalAccounts, "ok")
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("等待刷新")
                .font(.caption.weight(.black))
                .foregroundStyle(palette.text)
            Text("打开 App 并刷新一次。")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(palette.muted)
        }
    }

    private func miniMetric(_ value: String, _ title: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.caption.monospacedDigit().weight(.black))
                .foregroundStyle(palette.text)
            Text(title)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(palette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func percent(_ value: Double) -> String {
        "\(Int((min(1, max(0, value)) * 100).rounded()))%"
    }

    private func color(_ value: Double) -> Color {
        if value >= 0.8 { return palette.red }
        if value >= 0.65 { return palette.amber }
        return palette.sage
    }
}

private struct UsageRing: View {
    let account: WidgetSnapshotAccount
    let size: CGFloat
    let palette: WidgetPalette

    var body: some View {
        let session = min(1, max(0, account.session))
        let weekly = min(1, max(0, account.weekly))
        ZStack {
            Circle()
                .stroke(palette.track, lineWidth: size * 0.11)
            Circle()
                .trim(from: 0, to: weekly)
                .stroke(color(weekly), style: StrokeStyle(lineWidth: size * 0.11, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Circle()
                .stroke(palette.track, lineWidth: size * 0.08)
                .frame(width: size * 0.68, height: size * 0.68)
            Circle()
                .trim(from: 0, to: session)
                .stroke(color(session), style: StrokeStyle(lineWidth: size * 0.08, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: size * 0.68, height: size * 0.68)
            Text("\(Int((session * 100).rounded()))")
                .font(.system(size: size * 0.23, weight: .black, design: .rounded))
                .foregroundStyle(color(session))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(account.name) \(Int((session * 100).rounded())) percent")
    }

    private func color(_ value: Double) -> Color {
        if value >= 0.8 { return palette.red }
        if value >= 0.65 { return palette.amber }
        return palette.sage
    }
}

private struct WidgetPalette {
    let background: Color
    let text: Color
    let muted: Color
    let track: Color
    let sage: Color
    let amber: Color
    let red: Color

    init(_ prefs: UiPreferences) {
        let dark = prefs.appearance == .dark
        switch (prefs.theme, dark) {
        case (.clay, false):
            self.init(0xFBF7F1, 0x3A322B, 0xA89A8A, 0xF0E8DC, 0x7C9A5E, 0xD9A441, 0xC8553D)
        case (.latte, false):
            self.init(0xFAF4EA, 0x382F28, 0x9D8B78, 0xEADBC9, 0x7C8A4E, 0xC98A3C, 0xB9523F)
        case (.sandSage, false):
            self.init(0xF8F5EC, 0x30362B, 0x8E907D, 0xE4E5D4, 0x7C9A5E, 0xD9A441, 0xC26B4A)
        case (.clay, true):
            self.init(0x211B18, 0xF8EFE6, 0xB6A79A, 0x3A302A, 0x92B46E, 0xE0B14A, 0xE1634A)
        case (.latte, true):
            self.init(0x201A15, 0xF6EBDC, 0xB7A48F, 0x3A3025, 0x95A45C, 0xD49A46, 0xCF604B)
        case (.sandSage, true):
            self.init(0x1B1F18, 0xF0EEDF, 0xAAA994, 0x343A2C, 0x93B56F, 0xE0B14A, 0xD27655)
        }
    }

    private init(_ background: UInt32, _ text: UInt32, _ muted: UInt32, _ track: UInt32, _ sage: UInt32, _ amber: UInt32, _ red: UInt32) {
        self.background = Color(hex: background)
        self.text = Color(hex: text)
        self.muted = Color(hex: muted)
        self.track = Color(hex: track)
        self.sage = Color(hex: sage)
        self.amber = Color(hex: amber)
        self.red = Color(hex: red)
    }
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255
        )
    }
}

@main
struct Sub2APIWatchdogWidget: Widget {
    let kind = "Sub2APIWatchdogWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WatchdogWidgetProvider()) { entry in
            Sub2APIWatchdogWidgetView(entry: entry)
        }
        .configurationDisplayName("Sub2API Watchdog")
        .description("Active account session usage at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
