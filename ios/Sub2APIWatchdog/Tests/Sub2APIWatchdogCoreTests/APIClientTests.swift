import Foundation
import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class APIClientTests: XCTestCase {
    func testActiveAccountsSendsBearerHeaderAndFiltersActive() async throws {
        let session = MockSession(data: """
        {"code":0,"message":"ok","data":{"items":[
          {"id":1,"name":"A","status":"active","platform":"anthropic","groups":[{"id":1,"name":"G"}]},
          {"id":2,"name":"B","status":"inactive","platform":"anthropic","groups":[]}
        ],"total":2,"page":1,"page_size":100}}
        """)
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        let accounts = try await client.activeAccounts()

        XCTAssertEqual(accounts.map(\.id), [1])
        XCTAssertEqual(session.lastRequest?.value(forHTTPHeaderField: "Authorization"), "Bearer abc")
        XCTAssertEqual(session.lastRequest?.url?.query?.contains("status=active"), true)
    }

    func testActiveAccountsAcceptsBareArrayData() async throws {
        let session = MockSession(data: """
        {"code":0,"message":"ok","data":[{"id":1,"name":"A","status":"active","platform":"anthropic"}]}
        """)
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        let accounts = try await client.activeAccounts()

        XCTAssertEqual(accounts.map(\.id), [1])
    }

    func testOpenAIAccountsRefreshActiveAndPassiveUsage() async throws {
        let session = MockSession { request in
            let url = request.url!
            if url.path.hasSuffix("/admin/accounts") {
                return ("""
                {"code":0,"message":"ok","data":{"items":[
                  {"id":7,"name":"OpenAI","status":"active","platform":"openai","extra":{"codex_5h_used_percent":61,"codex_7d_used_percent":33}}
                ],"total":1,"page":1,"page_size":100}}
                """, 200)
            }
            if url.path.hasSuffix("/admin/accounts/7/usage"), url.query?.contains("source=active") == true {
                XCTAssertTrue(url.query?.contains("force=true") == true)
                return ("""
                {"code":0,"message":"ok","data":{"codex_5h_used_percent":0,"codex_5h_reset_at":"2026-07-02T10:00:00+08:00"}}
                """, 200)
            }
            if url.path.hasSuffix("/admin/accounts/7/usage"), url.query?.contains("source=passive") == true {
                return ("""
                {"code":0,"message":"ok","data":{"usage":{"used_percent":18,"reset_at":"2026-07-09T10:00:00+08:00"}}}
                """, 200)
            }
            XCTFail("unexpected URL \(url.absoluteString)")
            return (#"{"code":0,"message":"ok","data":{}}"#, 200)
        }
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        let accounts = try await client.activeAccounts()
        let account = accounts.first

        XCTAssertEqual(account?.extra?.codex5hUsedPercent, 0)
        XCTAssertEqual(account?.extra?.codex5hResetAt, "2026-07-02T10:00:00+08:00")
        XCTAssertEqual(account?.extra?.codex7dUsedPercent, 18)
        XCTAssertEqual(account?.extra?.codex7dResetAt, "2026-07-09T10:00:00+08:00")
        XCTAssertEqual(session.requests.count, 3)
    }

    func testOpenAIUsageNon401FailureKeepsListUsage() async throws {
        let session = MockSession { request in
            let url = request.url!
            if url.path.hasSuffix("/admin/accounts") {
                return ("""
                {"code":0,"message":"ok","data":{"items":[
                  {"id":8,"name":"OpenAI","status":"active","platform":"openai","extra":{"codex_5h_used_percent":61}}
                ],"total":1,"page":1,"page_size":100}}
                """, 200)
            }
            return (#"{"message":"boom"}"#, 500)
        }
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        let accounts = try await client.activeAccounts()
        let account = accounts.first

        XCTAssertEqual(account?.extra?.codex5hUsedPercent, 61)
    }

    func testDashboardStatsDecodesEnvelope() async throws {
        let session = MockSession(data: """
        {"code":0,"message":"ok","data":{"today_tokens":1200,"today_requests":42,"today_cost":0.72,"normal_accounts":9,"total_accounts":10}}
        """)
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        let stats = try await client.dashboardStats()

        XCTAssertEqual(stats.todayTokens, 1200)
        XCTAssertEqual(stats.todayRequests, 42)
        XCTAssertEqual(stats.todayCost, 0.72)
        XCTAssertEqual(stats.normalAccounts, 9)
        XCTAssertEqual(stats.totalAccounts, 10)
    }

    func testBusinessCode401MapsToHTTP401() async throws {
        let session = MockSession(data: #"{"code":401,"message":"unauthorized","data":null}"#)
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        do {
            _ = try await client.dashboardStats()
            XCTFail("expected 401")
        } catch WatchdogAPIError.httpStatus(let status) {
            XCTAssertEqual(status, 401)
        } catch {
            XCTFail("unexpected error \(error)")
        }
    }

    func testTodayUserUsageReadsPagesAndSortsLocalTodayUsers() async throws {
        let session = MockSession { request in
            let url = request.url!
            XCTAssertTrue(url.path.hasSuffix("/admin/users"))
            if url.query?.contains("page=1") == true {
                return ("""
                {"code":0,"message":"ok","data":{"items":[
                  {"id":1,"username":"alice","last_used_at":"2026-07-02T09:00:00+08:00"},
                  {"id":2,"username":"bob","last_used_at":"2026-07-01T23:59:00+08:00"}
                ],"total":3,"page":1,"page_size":2,"pages":2}}
                """, 200)
            }
            return ("""
            {"code":0,"message":"ok","data":{"items":[
              {"id":3,"name":"carol","last_used":"2026-07-02T11:30:00+08:00"}
            ],"total":3,"page":2,"page_size":2,"pages":2}}
            """, 200)
        }
        let client = WatchdogAPIClient(
            apiBase: URL(string: "https://agent.example.com/api/v1")!,
            tokenProvider: { "abc" },
            session: session
        )

        let summary = try await client.todayUserUsage(now: ISO8601DateFormatter().date(from: "2026-07-02T12:00:00+08:00")!)

        XCTAssertEqual(summary.count, 2)
        XCTAssertEqual(summary.users.map(\.username), ["carol", "alice"])
        XCTAssertEqual(summary.users.map(\.id), ["3", "1"])
    }
}

final class MockSession: HTTPSession, @unchecked Sendable {
    typealias Handler = (URLRequest) throws -> (String, Int)

    private let handler: Handler
    private let lock = NSLock()
    private var storedRequests: [URLRequest] = []

    var requests: [URLRequest] {
        lock.withLock {
            storedRequests
        }
    }

    var lastRequest: URLRequest? {
        requests.last
    }

    init(data: String, statusCode: Int = 200) {
        self.handler = { _ in (data, statusCode) }
    }

    init(handler: @escaping Handler) {
        self.handler = handler
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        lock.withLock {
            storedRequests.append(request)
        }

        let (payload, statusCode) = try handler(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: nil
        )!
        return (Data(payload.utf8), response)
    }
}
