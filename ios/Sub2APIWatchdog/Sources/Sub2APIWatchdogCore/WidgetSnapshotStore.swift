import Foundation

public enum WidgetSnapshotConfig {
    public static let appGroupIdentifier = "group.com.sub2api.watchdog"
    public static let storageKey = "widget.snapshot.v1"
    public static let preferencesKey = "ui.preferences.v1"
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
    public let weekly: Double

    enum CodingKeys: String, CodingKey {
        case id, name, platform, session, weekly
    }

    public init(id: Int, name: String, platform: String, session: Double, weekly: Double = 0) {
        self.id = id
        self.name = name
        self.platform = platform
        self.session = session
        self.weekly = weekly
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        platform = try container.decode(String.self, forKey: .platform)
        session = try container.decode(Double.self, forKey: .session)
        weekly = try container.decodeIfPresent(Double.self, forKey: .weekly) ?? 0
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(platform, forKey: .platform)
        try container.encode(session, forKey: .session)
        try container.encode(weekly, forKey: .weekly)
    }
}

public enum WidgetSnapshotStore {
    public static func makeSnapshot(from snapshot: WatchdogSnapshot, updatedAt: Date = Date()) -> WidgetSnapshot {
        let dashboard = snapshot.dashboard
        return WidgetSnapshot(
            updatedAt: updatedAt,
            accounts: AccountTransform.recentActiveAccounts(snapshot.accounts, limit: 5)
                .map { account in
                    WidgetSnapshotAccount(
                        id: account.id,
                        name: account.name,
                        platform: account.platform ?? "unknown",
                        session: WatchdogFormat.clampedPercentValue(WatchdogFormat.sessionUtilization(account)),
                        weekly: WatchdogFormat.clampedPercentValue(WatchdogFormat.weeklyUtilization(account))
                    )
                },
            todayTokens: WatchdogFormat.tokens(dashboard?.todayTokens),
            todayRequests: dashboard.map { "\($0.todayRequests)" } ?? "—",
            todayCost: WatchdogFormat.cost(dashboard?.todayCost),
            normalAccounts: dashboard.map { "\($0.normalAccounts)" } ?? "—"
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

public enum UiPreferencesStore {
    public static func load(defaults: UserDefaults? = nil) -> UiPreferences {
        let defaults = defaults ?? sharedDefaults()
        guard
            let data = defaults?.data(forKey: WidgetSnapshotConfig.preferencesKey),
            let prefs = try? JSONDecoder().decode(UiPreferences.self, from: data)
        else {
            return UiPreferences()
        }
        return prefs
    }

    public static func save(_ prefs: UiPreferences, defaults: UserDefaults? = nil) {
        let defaults = defaults ?? sharedDefaults()
        guard let data = try? JSONEncoder().encode(prefs) else { return }
        defaults?.set(data, forKey: WidgetSnapshotConfig.preferencesKey)
    }

    public static func clear(defaults: UserDefaults? = nil) {
        let defaults = defaults ?? sharedDefaults()
        defaults?.removeObject(forKey: WidgetSnapshotConfig.preferencesKey)
    }

    private static func sharedDefaults() -> UserDefaults? {
        UserDefaults(suiteName: WidgetSnapshotConfig.appGroupIdentifier) ?? .standard
    }
}
