import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class ServerConfigTests: XCTestCase {
    func testNormalizeOriginAddsHttpsAndDropsPath() {
        let origin = ServerConfig.normalizeOrigin("agent.example.com/admin/accounts")
        XCTAssertEqual(origin?.absoluteString, "https://agent.example.com")
    }

    func testBuildsApiAndLoginUrls() throws {
        let origin = try XCTUnwrap(ServerConfig.normalizeOrigin("https://agent.example.com"))
        XCTAssertEqual(ServerConfig.apiBase(from: origin).absoluteString, "https://agent.example.com/api/v1")
        XCTAssertEqual(ServerConfig.loginURL(from: origin).absoluteString, "https://agent.example.com/admin")
    }
}
