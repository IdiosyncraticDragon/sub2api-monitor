import Foundation

public enum WidgetSnapshotConfig {
    public static let appGroupIdentifier = "group.com.sub2api.watchdog"
    public static let storageKey = "widget.snapshot.v1"
    public static let widgetKind = "Sub2APIWatchdogWidget"
}

public struct WidgetSnapshot: Codable, Equatable, Sendable {
    public let updatedAt: Date
    public let accounts: [WidgetSnapshotAccount]
    public let todayTokens: String
    public let todayRequests: String
    public let todayCost: String
    public let normalAccounts: String

    public init(
        updatedAt: Date,
        accounts: [WidgetSnapshotAccount],
        todayTokens: String,
        todayRequests: String,
        todayCost: String,
        normalAccounts: String
    ) {
        self.updatedAt = updatedAt
        self.accounts = accounts
        self.todayTokens = todayTokens
        self.todayRequests = todayRequests
        self.todayCost = todayCost
        self.normalAccounts = normalAccounts
    }
}

public struct WidgetSnapshotAccount: Codable, Identifiable, Equatable, Sendable {
    public let id: Int
    public let name: String
    public let platform: String
    public let session: Double

    public init(id: Int, name: String, platform: String, session: Double) {
        self.id = id
        self.name = name
        self.platform = platform
        self.session = session
    }
}

public enum WidgetSnapshotStore {
    public static func makeSnapshot(from snapshot: WatchdogSnapshot, updatedAt: Date = Date()) -> WidgetSnapshot {
        WidgetSnapshot(
            updatedAt: updatedAt,
            accounts: snapshot.accounts
                .sorted { lhs, rhs in
                    WatchdogFormat.clampedPercentValue(WatchdogFormat.sessionUtilization(lhs.extra))
                        > WatchdogFormat.clampedPercentValue(WatchdogFormat.sessionUtilization(rhs.extra))
                }
                .prefix(6)
                .map { account in
                    WidgetSnapshotAccount(
                        id: account.id,
                        name: account.name,
                        platform: account.platform ?? "unknown",
                        session: WatchdogFormat.clampedPercentValue(WatchdogFormat.sessionUtilization(account.extra))
                    )
                },
            todayTokens: WatchdogFormat.tokens(snapshot.dashboard.todayTokens),
            todayRequests: "\(snapshot.dashboard.todayRequests)",
            todayCost: WatchdogFormat.cost(snapshot.dashboard.todayCost),
            normalAccounts: "\(snapshot.dashboard.normalAccounts)"
        )
    }

    public static func save(_ snapshot: WidgetSnapshot, defaults: UserDefaults? = nil) {
        let defaults = defaults ?? appGroupDefaults()
        guard let defaults else { return }
        if let data = try? JSONEncoder().encode(snapshot) {
            defaults.set(data, forKey: WidgetSnapshotConfig.storageKey)
        }
    }

    public static func load(defaults: UserDefaults? = nil) -> WidgetSnapshot? {
        let defaults = defaults ?? appGroupDefaults()
        guard
            let data = defaults?.data(forKey: WidgetSnapshotConfig.storageKey),
            let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
        else {
            return nil
        }
        return snapshot
    }

    public static func clear(defaults: UserDefaults? = nil) {
        let defaults = defaults ?? appGroupDefaults()
        defaults?.removeObject(forKey: WidgetSnapshotConfig.storageKey)
    }

    private static func appGroupDefaults() -> UserDefaults? {
        UserDefaults(suiteName: WidgetSnapshotConfig.appGroupIdentifier)
    }
}
