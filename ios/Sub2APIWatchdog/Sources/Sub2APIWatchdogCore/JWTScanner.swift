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
    private static let skewSeconds: TimeInterval = 60

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

    public static func matchJWTs(in raw: String?) -> [String] {
        guard let raw, let regex = try? NSRegularExpression(pattern: jwtPattern) else {
            return []
        }
        let range = NSRange(raw.startIndex..<raw.endIndex, in: raw)
        return regex.matches(in: raw, range: range).compactMap { match in
            guard let tokenRange = Range(match.range, in: raw) else { return nil }
            return String(raw[tokenRange])
        }
    }

    public static func decodePayload(_ token: String) -> [String: JSONValue]? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var base64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }
        guard
            let data = Data(base64Encoded: base64),
            case .object(let payload)? = try? JSONDecoder().decode(JSONValue.self, from: data)
        else {
            return nil
        }
        return payload
    }

    public static func isExpired(_ token: String, now: Date = Date()) -> Bool {
        guard
            let payload = decodePayload(token),
            case .number(let exp)? = payload["exp"]
        else {
            return true
        }
        return exp - skewSeconds <= now.timeIntervalSince1970
    }

    public static func isLikelyRefreshToken(_ token: String, storageKey: String = "") -> Bool {
        if storageKey.range(of: "refresh", options: .caseInsensitive) != nil {
            return true
        }
        guard let payload = decodePayload(token) else { return false }
        for key in ["typ", "type", "token_type", "tokenType", "token_use"] {
            if case .string(let value)? = payload[key],
               value.range(of: "refresh", options: .caseInsensitive) != nil {
                return true
            }
        }
        return false
    }

    public static func isUsableAccessToken(_ token: String, now: Date = Date(), storageKey: String = "") -> Bool {
        !isLikelyRefreshToken(token, storageKey: storageKey) && !isExpired(token, now: now)
    }

    public static func findAccessToken(in entries: [StorageEntry]) -> String? {
        let preferredEntries = entries.filter { entry in
            let key = entry.key.lowercased()
            return !key.contains("refresh")
                && (key.contains("access") || key.contains("auth") || key.contains("token") || key.contains("jwt"))
        }
        for entry in preferredEntries + entries.filter({ !preferredEntries.contains($0) }) {
            if let token = matchJWT(in: entry.value) {
                return token
            }
        }
        return nil
    }

    public static func findUsableAccessToken(in entries: [StorageEntry], now: Date = Date()) -> String? {
        for entry in entries {
            for token in matchJWTs(in: entry.value) where isUsableAccessToken(token, now: now, storageKey: entry.key) {
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
