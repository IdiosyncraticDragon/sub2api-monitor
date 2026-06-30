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

    func testLastUsed() {
        let now = ISO8601DateFormatter().date(from: "2026-06-29T12:00:00Z")!
        XCTAssertEqual(WatchdogFormat.lastUsed("2026-06-29T11:58:00Z", now: now), "2m ago")
        XCTAssertEqual(WatchdogFormat.lastUsed(nil, now: now), "Never")
    }
}
