import Foundation

public struct StorageEntry: Equatable, Sendable {
    public let key: String
    public let value: String?

    public init(key: String, value: String?) {
        self.key = key
        self.value = value
    }
}

public enum JWTScanner {
    private static let jwtPattern = #"eyJ[\w-]+\.[\w-]+\.[\w-]+"#

    public static func matchJWT(in raw: String?) -> String? {
        guard let raw, let regex = try? NSRegularExpression(pattern: jwtPattern) else {
            return nil
        }
        let range = NSRange(raw.startIndex..<raw.endIndex, in: raw)
        guard
            let match = regex.firstMatch(in: raw, range: range),
            let tokenRange = Range(match.range, in: raw)
        else {
            return nil
        }
        return String(raw[tokenRange])
    }

    public static func findAccessToken(in entries: [StorageEntry]) -> String? {
        for entry in entries {
            if let token = matchJWT(in: entry.value) {
                return token
            }
        }
        return nil
    }

    public static func findRefreshToken(in entries: [StorageEntry]) -> String? {
        for entry in entries where entry.key.range(of: "refresh", options: .caseInsensitive) != nil {
            if let token = matchJWT(in: entry.value) {
                return token
            }
        }
        return nil
    }
}
