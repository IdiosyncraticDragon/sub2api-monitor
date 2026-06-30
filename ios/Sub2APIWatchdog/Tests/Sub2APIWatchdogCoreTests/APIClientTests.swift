import Foundation
import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class APIClientTests: XCTestCase {
    func testActiveAccountsSendsBearerHeaderAndFiltersActive() async throws {
        let session = MockSession(data: """
        {"code":0,"message":"ok","data":{"items":[
          {"id":1,"name":"A","status":"active","groups":[{"id":1,"name":"G"}]},
          {"id":2,"name":"B","status":"inactive","groups":[]}
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

    func testDashboardStatsDecodesEnvelope() async throws {
        let session = MockSession(data: """
        {"code":0,"message":"ok","data":{"today_tokens":1200,"today_requests":42,"today_cost":0.72,"normal_accounts":9}}
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
    }
}

final class MockSession: HTTPSession, @unchecked Sendable {
    private let payload: Data
    private(set) var lastRequest: URLRequest?

    init(data: String) {
        self.payload = Data(data.utf8)
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        lastRequest = request
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )!
        return (payload, response)
    }
}
