import Foundation

public enum WatchdogAPIError: Error, Equatable {
    case missingToken
    case invalidResponse
    case httpStatus(Int)
    case apiMessage(String)
}

public protocol HTTPSession: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: HTTPSession {}

public struct WatchdogAPIClient: Sendable {
    public let apiBase: URL
    public let tokenProvider: @Sendable () -> String?
    public let session: HTTPSession

    public init(
        apiBase: URL,
        tokenProvider: @escaping @Sendable () -> String?,
        session: HTTPSession = URLSession.shared
    ) {
        self.apiBase = apiBase
        self.tokenProvider = tokenProvider
        self.session = session
    }

    public func activeAccounts() async throws -> [Account] {
        var components = URLComponents(url: apiBase.appending(path: "admin").appending(path: "accounts"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "status", value: "active"),
            URLQueryItem(name: "page", value: "1"),
            URLQueryItem(name: "page_size", value: "100")
        ]
        let list: FlexibleList<Account> = try await get(components.url!)
        return try await refreshOpenAIUsage(AccountTransform.active(list.items))
    }

    public func dashboardStats() async throws -> DashboardStats {
        try await get(apiBase.appending(path: "admin").appending(path: "dashboard").appending(path: "stats"))
    }

    public func todayUserUsage(now: Date = Date()) async throws -> UserUsageSummary {
        let users = try await allUsers()
        let calendar = Calendar.current
        let today = users.compactMap { user -> TodayUser? in
            guard
                let lastUsedAt = user.lastUsedAt ?? user.lastUsed ?? user.lastUsedTime,
                let date = WatchdogFormat.parseDate(lastUsedAt),
                calendar.isDate(date, inSameDayAs: now)
            else {
                return nil
            }
            let username = user.username?.trimmedNonEmpty
                ?? user.name?.trimmedNonEmpty
                ?? user.email?.trimmedNonEmpty
                ?? user.id
            return TodayUser(id: user.id, username: username, lastUsedAt: lastUsedAt)
        }
        .sorted { lhs, rhs in
            let left = WatchdogFormat.parseDate(lhs.lastUsedAt)?.timeIntervalSince1970 ?? 0
            let right = WatchdogFormat.parseDate(rhs.lastUsedAt)?.timeIntervalSince1970 ?? 0
            return left > right
        }

        return UserUsageSummary(count: today.count, users: today)
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        guard let token = tokenProvider(), !token.isEmpty else {
            throw WatchdogAPIError.missingToken
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WatchdogAPIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw WatchdogAPIError.httpStatus(http.statusCode)
        }

        let envelope = try JSONDecoder().decode(APIEnvelope<T>.self, from: data)
        guard envelope.code == 0 else {
            if envelope.code == 401 {
                throw WatchdogAPIError.httpStatus(401)
            }
            throw WatchdogAPIError.apiMessage(envelope.message)
        }
        guard let data = envelope.data else {
            throw WatchdogAPIError.invalidResponse
        }
        return data
    }

    private func accountUsage(id: Int, source: UsageSource) async throws -> AccountExtra {
        var components = URLComponents(
            url: apiBase
                .appending(path: "admin")
                .appending(path: "accounts")
                .appending(path: String(id))
                .appending(path: "usage"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [
            URLQueryItem(name: "source", value: source.rawValue),
            URLQueryItem(name: "force", value: "true")
        ]
        let payload: JSONValue = try await get(components.url!)
        return usageToExtra(payload, source: source)
    }

    private func refreshOpenAIUsage(_ accounts: [Account]) async throws -> [Account] {
        var refreshed: [Account] = []
        refreshed.reserveCapacity(accounts.count)

        for account in accounts {
            guard AccountTransform.isOpenAIAccount(account) else {
                refreshed.append(account)
                continue
            }

            do {
                async let active = accountUsage(id: account.id, source: .active)
                async let passive = accountUsage(id: account.id, source: .passive)
                let extra = mergeOpenAIUsage(
                    current: account.extra,
                    active: try await active,
                    passive: try await passive
                )
                refreshed.append(account.replacingExtra(extra))
            } catch WatchdogAPIError.httpStatus(let status) where status == 401 {
                throw WatchdogAPIError.httpStatus(401)
            } catch {
                refreshed.append(account)
            }
        }

        return refreshed
    }

    private func mergeOpenAIUsage(current: AccountExtra?, active: AccountExtra, passive: AccountExtra) -> AccountExtra {
        AccountExtra(
            sessionWindowUtilization: current?.sessionWindowUtilization,
            passiveUsage7dUtilization: current?.passiveUsage7dUtilization,
            codex5hUsedPercent: active.codex5hUsedPercent,
            codex5hResetAt: active.codex5hResetAt,
            codex7dUsedPercent: passive.codex7dUsedPercent,
            codex7dResetAt: passive.codex7dResetAt,
            passiveUsage7dReset: current?.passiveUsage7dReset,
            passiveUsageSampledAt: current?.passiveUsageSampledAt,
            subscriptionType: current?.subscriptionType,
            plan: current?.plan,
            accountType: current?.accountType
        )
    }

    private func usageToExtra(_ payload: JSONValue, source: UsageSource) -> AccountExtra {
        switch source {
        case .active:
            return AccountExtra(
                codex5hUsedPercent: findNumber(payload, keys: [
                    "codex_5h_used_percent",
                    "used_percent",
                    "usage_percent",
                    "utilization_percent",
                    "percent"
                ]),
                codex5hResetAt: findString(payload, keys: [
                    "codex_5h_reset_at",
                    "reset_at",
                    "resets_at",
                    "reset_time"
                ])
            )
        case .passive:
            return AccountExtra(
                codex7dUsedPercent: findNumber(payload, keys: [
                    "codex_7d_used_percent",
                    "used_percent",
                    "usage_percent",
                    "utilization_percent",
                    "percent"
                ]),
                codex7dResetAt: findString(payload, keys: [
                    "codex_7d_reset_at",
                    "reset_at",
                    "resets_at",
                    "reset_time"
                ])
            )
        }
    }

    private func findNumber(_ value: JSONValue, keys: [String]) -> Double? {
        switch value {
        case .object(let object):
            for key in keys {
                if case .number(let number)? = object[key] {
                    return number
                }
            }
            for child in object.values {
                if let found = findNumber(child, keys: keys) {
                    return found
                }
            }
            return nil
        case .array(let array):
            for child in array {
                if let found = findNumber(child, keys: keys) {
                    return found
                }
            }
            return nil
        default:
            return nil
        }
    }

    private func findString(_ value: JSONValue, keys: [String]) -> String? {
        switch value {
        case .object(let object):
            for key in keys {
                if case .string(let string)? = object[key] {
                    return string
                }
            }
            for child in object.values {
                if let found = findString(child, keys: keys) {
                    return found
                }
            }
            return nil
        case .array(let array):
            for child in array {
                if let found = findString(child, keys: keys) {
                    return found
                }
            }
            return nil
        default:
            return nil
        }
    }

    private func allUsers() async throws -> [AdminUser] {
        let first = try await usersPage("1")
        var users = first.items
        let pageSize = max(first.pageSize ?? max(first.items.count, 1), 1)
        let expectedPages = first.pages ?? Int(ceil(Double(first.total ?? first.items.count) / Double(pageSize)))

        guard expectedPages > 1 else { return users }
        for page in 2...expectedPages {
            let next = try await usersPage(String(page))
            users.append(contentsOf: next.items)
        }
        return users
    }

    private func usersPage(_ page: String) async throws -> FlexibleList<AdminUser> {
        var components = URLComponents(url: apiBase.appending(path: "admin").appending(path: "users"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "page", value: page),
            URLQueryItem(name: "page_size", value: "100")
        ]
        return try await get(components.url!)
    }
}

public struct WatchdogSnapshot: Equatable, Sendable {
    public let accounts: [Account]
    public let dashboard: DashboardStats?
    public let userUsage: UserUsageSummary?

    public init(accounts: [Account], dashboard: DashboardStats? = nil, userUsage: UserUsageSummary? = nil) {
        self.accounts = accounts
        self.dashboard = dashboard
        self.userUsage = userUsage
    }
}

public protocol WatchdogDataLoading: Sendable {
    func snapshot(apiBase: URL, token: String) async throws -> WatchdogSnapshot
}

public struct WatchdogRemoteLoader: WatchdogDataLoading {
    private let session: HTTPSession

    public init(session: HTTPSession = URLSession.shared) {
        self.session = session
    }

    public func snapshot(apiBase: URL, token: String) async throws -> WatchdogSnapshot {
        let client = WatchdogAPIClient(apiBase: apiBase, tokenProvider: { token }, session: session)
        async let accounts = client.activeAccounts()
        async let stats = optional { try await client.dashboardStats() }
        async let userUsage = optional { try await client.todayUserUsage() }
        let accountList = try await accounts
        let dashboard = await stats
        let users = await userUsage
        return WatchdogSnapshot(accounts: accountList, dashboard: dashboard, userUsage: users)
    }
}

private func optional<T>(_ operation: @Sendable @escaping () async throws -> T) async -> T? {
    try? await operation()
}

private enum UsageSource: String {
    case active
    case passive
}

private extension String {
    var trimmedNonEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
