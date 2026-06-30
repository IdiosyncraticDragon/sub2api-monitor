import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class JWTScannerTests: XCTestCase {
    func testMatchesJWTInsideJSONValue() {
        let token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTAwMDB9.signature_part"
        XCTAssertEqual(JWTScanner.matchJWT(in: #"{"token":"\#(token)"}"#), token)
    }

    func testFindsAccessAndRefreshTokens() {
        let access = "eyJaccess.header.signature"
        let refresh = "eyJrefresh.header.signature"
        let entries = [
            StorageEntry(key: "auth_user", value: #"{"access":"\#(access)"}"#),
            StorageEntry(key: "refresh_token", value: refresh)
        ]

        XCTAssertEqual(JWTScanner.findAccessToken(in: entries), access)
        XCTAssertEqual(JWTScanner.findRefreshToken(in: entries), refresh)
    }
}
