import Foundation
import Security

public protocol CredentialStoring: Sendable {
    func loadToken() -> String?
    func saveToken(_ token: String) throws
    func clearToken() throws
}

public final class KeychainCredentialStore: CredentialStoring, @unchecked Sendable {
    private let service: String
    private let account: String

    public init(service: String = "com.sub2api.watchdog", account: String = "bearer-token") {
        self.service = service
        self.account = account
    }

    public func loadToken() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func saveToken(_ token: String) throws {
        try clearToken()
        var query = baseQuery()
        query[kSecValueData as String] = Data(token.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError(status: status)
        }
    }

    public func clearToken() throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError(status: status)
        }
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

public struct KeychainError: LocalizedError, Equatable {
    public let status: OSStatus

    public var errorDescription: String? {
        "Keychain OSStatus \(status)"
    }
}
