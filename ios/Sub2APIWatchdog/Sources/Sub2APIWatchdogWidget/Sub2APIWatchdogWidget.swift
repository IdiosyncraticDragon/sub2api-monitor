import SwiftUI
import WidgetKit
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

struct WatchdogWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct WatchdogWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchdogWidgetEntry {
        WatchdogWidgetEntry(date: Date(), snapshot: sampleSnapshot)
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchdogWidgetEntry) -> Void) {
        completion(WatchdogWidgetEntry(date: Date(), snapshot: WidgetSnapshotStore.load() ?? sampleSnapshot))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchdogWidgetEntry>) -> Void) {
        let entry = WatchdogWidgetEntry(date: Date(), snapshot: WidgetSnapshotStore.load())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }

    private var sampleSnapshot: WidgetSnapshot {
        WidgetSnapshot(
            updatedAt: Date(),
            accounts: [
                WidgetSnapshotAccount(id: 1, name: "openai-main", platform: "openai", session: 0.42),
                WidgetSnapshotAccount(id: 2, name: "openai-backup", platform: "openai", session: 0.68)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Sub2API")
                    .font(.headline.weight(.black))
                    .foregroundStyle(WidgetPalette.text)
                Spacer()
                Text(entry.snapshot == nil ? "Open App" : "Active")
                    .font(.caption2.weight(.black))
                    .foregroundStyle(WidgetPalette.muted)
            }

            if let snapshot = entry.snapshot, !snapshot.accounts.isEmpty {
                if family == .systemSmall {
                    ringStack(snapshot.accounts)
                } else {
                    segmentList(snapshot)
                }
            } else {
                emptyState
            }

            Text(entry.snapshot?.updatedAt ?? entry.date, style: .time)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(WidgetPalette.muted)
        }
        .containerBackground(WidgetPalette.background, for: .widget)
    }

    private func ringStack(_ accounts: [WidgetSnapshotAccount]) -> some View {
        HStack(spacing: 8) {
            ForEach(accounts.prefix(3)) { account in
                UsageRing(account: account, size: 42)
            }
        }
    }

    private func segmentList(_ snapshot: WidgetSnapshot) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                miniMetric(snapshot.todayTokens, "tokens")
                miniMetric(snapshot.todayRequests, "req")
                miniMetric(snapshot.normalAccounts, "ok")
            }
            ForEach(snapshot.accounts.prefix(3)) { account in
                HStack(spacing: 8) {
                    UsageRing(account: account, size: 30)
                    Text(account.name)
                        .font(.caption.weight(.black))
                        .foregroundStyle(WidgetPalette.text)
                        .lineLimit(1)
                    Spacer()
                    Text(percent(account.session))
                        .font(.caption.monospacedDigit().weight(.black))
                        .foregroundStyle(color(account.session))
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Waiting for refresh")
                .font(.caption.weight(.black))
                .foregroundStyle(WidgetPalette.text)
            Text("Open the app and refresh once.")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(WidgetPalette.muted)
        }
    }

    private func miniMetric(_ value: String, _ title: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.caption.monospacedDigit().weight(.black))
                .foregroundStyle(WidgetPalette.text)
            Text(title)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(WidgetPalette.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func percent(_ value: Double) -> String {
        "\(Int((min(1, max(0, value)) * 100).rounded()))%"
    }

    private func color(_ value: Double) -> Color {
        if value >= 0.8 { return WidgetPalette.red }
        if value >= 0.65 { return WidgetPalette.amber }
        return WidgetPalette.sage
    }
}

private struct UsageRing: View {
    let account: WidgetSnapshotAccount
    let size: CGFloat

    var body: some View {
        let value = min(1, max(0, account.session))
        ZStack {
            Circle()
                .stroke(WidgetPalette.track, lineWidth: size * 0.11)
            Circle()
                .trim(from: 0, to: value)
                .stroke(color(value), style: StrokeStyle(lineWidth: size * 0.11, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((value * 100).rounded()))")
                .font(.system(size: size * 0.25, weight: .black, design: .rounded))
                .foregroundStyle(color(value))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(account.name) \(Int((value * 100).rounded())) percent")
    }

    private func color(_ value: Double) -> Color {
        if value >= 0.8 { return WidgetPalette.red }
        if value >= 0.65 { return WidgetPalette.amber }
        return WidgetPalette.sage
    }
}

private enum WidgetPalette {
    static let background = Color(hex: 0xFBF7F1)
    static let text = Color(hex: 0x3A322B)
    static let muted = Color(hex: 0xA89A8A)
    static let track = Color(hex: 0xF0E8DC)
    static let sage = Color(hex: 0x7C9A5E)
    static let amber = Color(hex: 0xD9A441)
    static let red = Color(hex: 0xC8553D)
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
