import Foundation

public struct APIEnvelope<T: Decodable>: Decodable {
    public let code: Int
    public let message: String
    public let data: T?
}

public struct PaginatedResponse<T: Decodable>: Decodable {
    public let items: [T]
    public let total: Int
    public let page: Int
    public let pageSize: Int
    public let pages: Int?

    enum CodingKeys: String, CodingKey {
        case items, total, page, pages
        case pageSize = "page_size"
    }
}

public struct FlexibleList<T: Decodable>: Decodable {
    public let items: [T]
    public let total: Int?
    public let page: Int?
    public let pageSize: Int?
    public let pages: Int?

    public init(items: [T], total: Int? = nil, page: Int? = nil, pageSize: Int? = nil, pages: Int? = nil) {
        self.items = items
        self.total = total
        self.page = page
        self.pageSize = pageSize
        self.pages = pages
    }

    public init(from decoder: Decoder) throws {
        let single = try decoder.singleValueContainer()
        if let items = try? single.decode([T].self) {
            self.init(items: items)
            return
        }

        let page = try PaginatedResponse<T>(from: decoder)
        self.init(
            items: page.items,
            total: page.total,
            page: page.page,
            pageSize: page.pageSize,
            pages: page.pages
        )
    }
}

public enum JSONValue: Decodable, Equatable, Sendable {
    case object([String: JSONValue])
    case array([JSONValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let object = try? container.decode([String: JSONValue].self) {
            self = .object(object)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else {
            self = .null
        }
    }
}

public struct AccountGroup: Decodable, Equatable, Sendable {
    public let id: Int
    public let name: String
    public let platform: String?
    public let subscriptionType: String?

    enum CodingKeys: String, CodingKey {
        case id, name, platform
        case subscriptionType = "subscription_type"
    }
}

public struct AccountExtra: Decodable, Equatable, Sendable {
    public let sessionWindowUtilization: Double?
    public let passiveUsage7dUtilization: Double?
    public let codex5hUsedPercent: Double?
    public let codex5hResetAt: String?
    public let codex7dUsedPercent: Double?
    public let codex7dResetAt: String?
    public let passiveUsage7dReset: Double?
    public let passiveUsageSampledAt: String?
    public let subscriptionType: String?
    public let plan: String?
    public let accountType: String?

    public init(
        sessionWindowUtilization: Double? = nil,
        passiveUsage7dUtilization: Double? = nil,
        codex5hUsedPercent: Double? = nil,
        codex5hResetAt: String? = nil,
        codex7dUsedPercent: Double? = nil,
        codex7dResetAt: String? = nil,
        passiveUsage7dReset: Double? = nil,
        passiveUsageSampledAt: String? = nil,
        subscriptionType: String? = nil,
        plan: String? = nil,
        accountType: String? = nil
    ) {
        self.sessionWindowUtilization = sessionWindowUtilization
        self.passiveUsage7dUtilization = passiveUsage7dUtilization
        self.codex5hUsedPercent = codex5hUsedPercent
        self.codex5hResetAt = codex5hResetAt
        self.codex7dUsedPercent = codex7dUsedPercent
        self.codex7dResetAt = codex7dResetAt
        self.passiveUsage7dReset = passiveUsage7dReset
        self.passiveUsageSampledAt = passiveUsageSampledAt
        self.subscriptionType = subscriptionType
        self.plan = plan
        self.accountType = accountType
    }

    enum CodingKeys: String, CodingKey {
        case sessionWindowUtilization = "session_window_utilization"
        case passiveUsage7dUtilization = "passive_usage_7d_utilization"
        case codex5hUsedPercent = "codex_5h_used_percent"
        case codex5hResetAt = "codex_5h_reset_at"
        case codex7dUsedPercent = "codex_7d_used_percent"
        case codex7dResetAt = "codex_7d_reset_at"
        case passiveUsage7dReset = "passive_usage_7d_reset"
        case passiveUsageSampledAt = "passive_usage_sampled_at"
        case subscriptionType = "subscription_type"
        case plan
        case accountType = "account_type"
    }
}

public struct Account: Decodable, Identifiable, Equatable, Sendable {
    public let id: Int
    public let name: String
    public let status: String
    public let platform: String?
    public let type: String?
    public let subscriptionType: String?
    public let plan: String?
    public let accountType: String?
    public let notes: String?
    public let lastUsedAt: String?
    public let extra: AccountExtra?
    public let sessionWindowStart: String?
    public let sessionWindowEnd: String?
    public let sessionWindowStatus: String?
    public let rateLimitedAt: String?
    public let rateLimitResetAt: String?
    public let overloadUntil: String?
    public let groups: [AccountGroup]?
    public let concurrency: Int?
    public let currentConcurrency: Int?

    public init(
        id: Int,
        name: String,
        status: String,
        platform: String? = nil,
        type: String? = nil,
        subscriptionType: String? = nil,
        plan: String? = nil,
        accountType: String? = nil,
        notes: String? = nil,
        lastUsedAt: String? = nil,
        extra: AccountExtra? = nil,
        sessionWindowStart: String? = nil,
        sessionWindowEnd: String? = nil,
        sessionWindowStatus: String? = nil,
        rateLimitedAt: String? = nil,
        rateLimitResetAt: String? = nil,
        overloadUntil: String? = nil,
        groups: [AccountGroup]? = nil,
        concurrency: Int? = nil,
        currentConcurrency: Int? = nil
    ) {
        self.id = id
        self.name = name
        self.status = status
        self.platform = platform
        self.type = type
        self.subscriptionType = subscriptionType
        self.plan = plan
        self.accountType = accountType
        self.notes = notes
        self.lastUsedAt = lastUsedAt
        self.extra = extra
        self.sessionWindowStart = sessionWindowStart
        self.sessionWindowEnd = sessionWindowEnd
        self.sessionWindowStatus = sessionWindowStatus
        self.rateLimitedAt = rateLimitedAt
        self.rateLimitResetAt = rateLimitResetAt
        self.overloadUntil = overloadUntil
        self.groups = groups
        self.concurrency = concurrency
        self.currentConcurrency = currentConcurrency
    }

    enum CodingKeys: String, CodingKey {
        case id, name, status, platform, type, notes, extra, groups, concurrency, plan
        case subscriptionType = "subscription_type"
        case accountType = "account_type"
        case lastUsedAt = "last_used_at"
        case sessionWindowStart = "session_window_start"
        case sessionWindowEnd = "session_window_end"
        case sessionWindowStatus = "session_window_status"
        case rateLimitedAt = "rate_limited_at"
        case rateLimitResetAt = "rate_limit_reset_at"
        case overloadUntil = "overload_until"
        case currentConcurrency = "current_concurrency"
    }

    public func replacingExtra(_ extra: AccountExtra?) -> Account {
        Account(
            id: id,
            name: name,
            status: status,
            platform: platform,
            type: type,
            subscriptionType: subscriptionType,
            plan: plan,
            accountType: accountType,
            notes: notes,
            lastUsedAt: lastUsedAt,
            extra: extra,
            sessionWindowStart: sessionWindowStart,
            sessionWindowEnd: sessionWindowEnd,
            sessionWindowStatus: sessionWindowStatus,
            rateLimitedAt: rateLimitedAt,
            rateLimitResetAt: rateLimitResetAt,
            overloadUntil: overloadUntil,
            groups: groups,
            concurrency: concurrency,
            currentConcurrency: currentConcurrency
        )
    }
}

public struct DashboardStats: Decodable, Equatable, Sendable {
    public let todayTokens: Int
    public let todayRequests: Int
    public let todayCost: Double
    public let todayInputTokens: Int?
    public let todayOutputTokens: Int?
    public let normalAccounts: Int
    public let totalAccounts: Int?
    public let ratelimitAccounts: Int?
    public let tpm: Double?
    public let rpm: Double?
    public let statsUpdatedAt: String?

    public init(
        todayTokens: Int,
        todayRequests: Int,
        todayCost: Double,
        normalAccounts: Int,
        todayInputTokens: Int? = nil,
        todayOutputTokens: Int? = nil,
        totalAccounts: Int? = nil,
        ratelimitAccounts: Int? = nil,
        tpm: Double? = nil,
        rpm: Double? = nil,
        statsUpdatedAt: String? = nil
    ) {
        self.todayTokens = todayTokens
        self.todayRequests = todayRequests
        self.todayCost = todayCost
        self.normalAccounts = normalAccounts
        self.todayInputTokens = todayInputTokens
        self.todayOutputTokens = todayOutputTokens
        self.totalAccounts = totalAccounts
        self.ratelimitAccounts = ratelimitAccounts
        self.tpm = tpm
        self.rpm = rpm
        self.statsUpdatedAt = statsUpdatedAt
    }

    enum CodingKeys: String, CodingKey {
        case todayTokens = "today_tokens"
        case todayRequests = "today_requests"
        case todayCost = "today_cost"
        case todayInputTokens = "today_input_tokens"
        case todayOutputTokens = "today_output_tokens"
        case normalAccounts = "normal_accounts"
        case totalAccounts = "total_accounts"
        case ratelimitAccounts = "ratelimit_accounts"
        case tpm, rpm
        case statsUpdatedAt = "stats_updated_at"
    }
}

public struct AdminUser: Decodable, Equatable, Sendable {
    public let id: String
    public let username: String?
    public let name: String?
    public let email: String?
    public let lastUsedAt: String?
    public let lastUsed: String?
    public let lastUsedTime: String?

    enum CodingKeys: String, CodingKey {
        case id, username, name, email
        case lastUsedAt = "last_used_at"
        case lastUsed = "last_used"
        case lastUsedTime = "last_used_time"
    }

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        email: String? = nil,
        lastUsedAt: String? = nil,
        lastUsed: String? = nil,
        lastUsedTime: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.email = email
        self.lastUsedAt = lastUsedAt
        self.lastUsed = lastUsed
        self.lastUsedTime = lastUsedTime
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let stringID = try? container.decode(String.self, forKey: .id) {
            id = stringID
        } else if let intID = try? container.decode(Int.self, forKey: .id) {
            id = String(intID)
        } else {
            id = ""
        }
        username = try? container.decodeIfPresent(String.self, forKey: .username)
        name = try? container.decodeIfPresent(String.self, forKey: .name)
        email = try? container.decodeIfPresent(String.self, forKey: .email)
        lastUsedAt = try? container.decodeIfPresent(String.self, forKey: .lastUsedAt)
        lastUsed = try? container.decodeIfPresent(String.self, forKey: .lastUsed)
        lastUsedTime = try? container.decodeIfPresent(String.self, forKey: .lastUsedTime)
    }
}

public struct TodayUser: Identifiable, Equatable, Sendable {
    public let id: String
    public let username: String
    public let lastUsedAt: String

    public init(id: String, username: String, lastUsedAt: String) {
        self.id = id
        self.username = username
        self.lastUsedAt = lastUsedAt
    }
}

public struct UserUsageSummary: Equatable, Sendable {
    public let count: Int
    public let users: [TodayUser]

    public init(count: Int, users: [TodayUser]) {
        self.count = count
        self.users = users
    }
}

public struct AccountSection: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let accounts: [Account]

    public init(name: String, accounts: [Account]) {
        self.id = name
        self.name = name
        self.accounts = accounts
    }
}

public enum ThemeKey: String, Codable, CaseIterable, Equatable, Sendable {
    case clay
    case latte
    case sandSage

    public var label: String {
        switch self {
        case .clay: return "陶土 Clay"
        case .latte: return "拿铁 Latte"
        case .sandSage: return "沙砾 Sage"
        }
    }
}

public enum Appearance: String, Codable, CaseIterable, Equatable, Sendable {
    case light
    case dark

    public var label: String {
        switch self {
        case .light: return "浅色"
        case .dark: return "深色"
        }
    }
}

public enum WidgetDisplayStyle: String, Codable, CaseIterable, Equatable, Sendable {
    case rings
    case segments
    case spotlight

    public var label: String {
        switch self {
        case .rings: return "进度环"
        case .segments: return "分段条"
        case .spotlight: return "聚光泡"
        }
    }
}

public struct UiPreferences: Codable, Equatable, Sendable {
    public var theme: ThemeKey
    public var appearance: Appearance
    public var widgetStyle: WidgetDisplayStyle

    public init(
        theme: ThemeKey = .clay,
        appearance: Appearance = .light,
        widgetStyle: WidgetDisplayStyle = .rings
    ) {
        self.theme = theme
        self.appearance = appearance
        self.widgetStyle = widgetStyle
    }
}
