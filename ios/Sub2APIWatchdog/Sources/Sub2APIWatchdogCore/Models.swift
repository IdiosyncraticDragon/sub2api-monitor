import Foundation

public struct APIEnvelope<T: Decodable>: Decodable {
    public let code: Int
    public let message: String
    public let data: T
}

public struct PaginatedResponse<T: Decodable>: Decodable {
    public let items: [T]
    public let total: Int
    public let page: Int
    public let pageSize: Int

    enum CodingKeys: String, CodingKey {
        case items, total, page
        case pageSize = "page_size"
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
    public let passiveUsage7dReset: Double?
    public let passiveUsageSampledAt: String?

    enum CodingKeys: String, CodingKey {
        case sessionWindowUtilization = "session_window_utilization"
        case passiveUsage7dUtilization = "passive_usage_7d_utilization"
        case passiveUsage7dReset = "passive_usage_7d_reset"
        case passiveUsageSampledAt = "passive_usage_sampled_at"
    }
}

public struct Account: Decodable, Identifiable, Equatable, Sendable {
    public let id: Int
    public let name: String
    public let status: String
    public let platform: String?
    public let type: String?
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

    enum CodingKeys: String, CodingKey {
        case id, name, status, platform, type, notes, extra, groups, concurrency
        case lastUsedAt = "last_used_at"
        case sessionWindowStart = "session_window_start"
        case sessionWindowEnd = "session_window_end"
        case sessionWindowStatus = "session_window_status"
        case rateLimitedAt = "rate_limited_at"
        case rateLimitResetAt = "rate_limit_reset_at"
        case overloadUntil = "overload_until"
        case currentConcurrency = "current_concurrency"
    }
}

public struct DashboardStats: Decodable, Equatable, Sendable {
    public let todayTokens: Int
    public let todayRequests: Int
    public let todayCost: Double
    public let normalAccounts: Int

    enum CodingKeys: String, CodingKey {
        case todayTokens = "today_tokens"
        case todayRequests = "today_requests"
        case todayCost = "today_cost"
        case normalAccounts = "normal_accounts"
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
