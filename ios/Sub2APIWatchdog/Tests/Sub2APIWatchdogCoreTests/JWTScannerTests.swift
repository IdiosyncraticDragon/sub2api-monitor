import Foundation
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
        let access = testJWT(exp: 1_790_000_000)
        let refresh = testJWT(exp: 1_790_000_000, tokenUse: "refresh")
        let entries = [
            StorageEntry(key: "auth_user", value: #"{"access":"\#(access)"}"#),
            StorageEntry(key: "refresh_token", value: refresh)
        ]

        XCTAssertEqual(JWTScanner.findAccessToken(in: entries), access)
        XCTAssertEqual(JWTScanner.findRefreshToken(in: entries), refresh)
    }

    func testPrefersAccessTokenOverRefreshToken() {
        let refresh = testJWT(exp: 1_790_000_000, tokenUse: "refresh")
        let access = testJWT(exp: 1_790_000_000)
        let entries = [
            StorageEntry(key: "refresh_token", value: refresh),
            StorageEntry(key: "access_token", value: access)
        ]

        XCTAssertEqual(JWTScanner.findAccessToken(in: entries), access)
        XCTAssertEqual(JWTScanner.findUsableAccessToken(in: entries, now: Date(timeIntervalSince1970: 1_700_000_000)), access)
    }

    func testUsableAccessTokenRejectsExpiredAndRefreshTokens() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let expired = testJWT(exp: 1_700_000_030)
        let refresh = testJWT(exp: 1_790_000_000, tokenUse: "refresh")
        let access = testJWT(exp: 1_790_000_000)

        XCTAssertTrue(JWTScanner.isExpired(expired, now: now))
        XCTAssertFalse(JWTScanner.isUsableAccessToken(refresh, now: now))
        XCTAssertTrue(JWTScanner.isUsableAccessToken(access, now: now))
    }
}

func testJWT(exp: Int, tokenUse: String? = nil) -> String {
    let header = #"{"alg":"none"}"#
    let tokenUseJSON = tokenUse.map { #","token_use":"\#($0)""# } ?? ""
    let payload = #"{"exp":\#(exp)\#(tokenUseJSON)}"#
    return [header, payload, "signature"].map(base64URL).joined(separator: ".")
}

private func base64URL(_ raw: String) -> String {
    Data(raw.utf8)
        .base64EncodedString()
        .replacingOccurrences(of: "=", with: "")
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
}
