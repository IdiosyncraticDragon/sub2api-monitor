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
    private let decoder: JSONDecoder

    public init(
        apiBase: URL,
        tokenProvider: @escaping @Sendable () -> String?,
        session: HTTPSession = URLSession.shared
    ) {
        self.apiBase = apiBase
        self.tokenProvider = tokenProvider
        self.session = session
        self.decoder = JSONDecoder()
    }

    public func activeAccounts() async throws -> [Account] {
        var components = URLComponents(url: apiBase.appending(path: "admin").appending(path: "accounts"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "status", value: "active"),
            URLQueryItem(name: "page", value: "1"),
            URLQueryItem(name: "page_size", value: "100")
        ]
        let page: PaginatedResponse<Account> = try await get(components.url!)
        return AccountTransform.active(page.items)
    }

    public func dashboardStats() async throws -> DashboardStats {
        try await get(apiBase.appending(path: "admin").appending(path: "dashboard").appending(path: "stats"))
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

        let envelope = try decoder.decode(APIEnvelope<T>.self, from: data)
        guard envelope.code == 0 else {
            throw WatchdogAPIError.apiMessage(envelope.message)
        }
        return envelope.data
    }
}

public struct WatchdogSnapshot: Equatable, Sendable {
    public let accounts: [Account]
    public let dashboard: DashboardStats

    public init(accounts: [Account], dashboard: DashboardStats) {
        self.accounts = accounts
        self.dashboard = dashboard
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
        async let stats = client.dashboardStats()
        return try await WatchdogSnapshot(accounts: accounts, dashboard: stats)
    }
}
