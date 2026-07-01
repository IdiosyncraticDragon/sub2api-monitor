import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class FormattingTests: XCTestCase {
    func testPercentAndTokens() {
        XCTAssertEqual(WatchdogFormat.percent(0.428), "43%")
        XCTAssertEqual(WatchdogFormat.percent(nil), "-")
        XCTAssertEqual(WatchdogFormat.tokens(999), "999")
        XCTAssertEqual(WatchdogFormat.tokens(1_250), "1.2k")
        XCTAssertEqual(WatchdogFormat.tokens(2_500_000), "2.5M")
    }

    func testOpenAIUsagePercentFieldsNormalizeToFractions() throws {
        let extra = try JSONDecoder().decode(AccountExtra.self, from: Data("""
        {"codex_5h_used_percent":42,"codex_7d_used_percent":87}
        """.utf8))

        XCTAssertEqual(WatchdogFormat.sessionUtilization(extra), 0.42)
        XCTAssertEqual(WatchdogFormat.weeklyUtilization(extra), 0.87)
        XCTAssertEqual(WatchdogFormat.percent(WatchdogFormat.sessionUtilization(extra)), "42%")
    }

    func testLastUsed() {
        let now = ISO8601DateFormatter().date(from: "2026-06-29T12:00:00Z")!
        XCTAssertEqual(WatchdogFormat.lastUsed("2026-06-29T11:58:00Z", now: now), "2m ago")
        XCTAssertEqual(WatchdogFormat.lastUsed(nil, now: now), "Never")
    }
}
