import Foundation

public enum ServerConfig {
    public static func normalizeOrigin(_ input: String) -> URL? {
        var value = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }
        if !value.lowercased().hasPrefix("http://") && !value.lowercased().hasPrefix("https://") {
            value = "https://" + value
        }
        guard let url = URL(string: value), let scheme = url.scheme, let host = url.host else {
            return nil
        }
        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        components.port = url.port
        return components.url
    }

    public static func apiBase(from origin: URL) -> URL {
        origin.appending(path: "api").appending(path: "v1")
    }

    public static func loginURL(from origin: URL) -> URL {
        origin.appending(path: "admin")
    }
}
