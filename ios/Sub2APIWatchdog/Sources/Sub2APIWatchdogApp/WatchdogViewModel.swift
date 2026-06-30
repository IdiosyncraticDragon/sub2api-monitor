import Foundation
import SwiftUI
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

@MainActor
final class WatchdogViewModel: ObservableObject {
    @AppStorage("serverOrigin") var serverOrigin = ""
    @Published var tokenInput = ""
    @Published var sections: [AccountSection] = []
    @Published var dashboard: DashboardStats?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastRefreshedAt: Date?

    private let credentials: CredentialStoring
    private let loader: WatchdogDataLoading
    private let now: @MainActor () -> Date

    init(
        credentials: CredentialStoring = KeychainCredentialStore(),
        loader: WatchdogDataLoading = WatchdogRemoteLoader(),
        now: @escaping @MainActor () -> Date = Date.init,
        initialServerOrigin: String? = nil
    ) {
        self.credentials = credentials
        self.loader = loader
        self.now = now
        self.tokenInput = credentials.loadToken() ?? ""
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-reset") {
            self.tokenInput = ""
            self.serverOrigin = ""
            try? credentials.clearToken()
        }
        if let initialServerOrigin {
            self.serverOrigin = initialServerOrigin
        }
    }

    var isConfigured: Bool {
        ServerConfig.normalizeOrigin(serverOrigin) != nil && !tokenInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var loginURL: URL? {
        ServerConfig.normalizeOrigin(serverOrigin).map(ServerConfig.loginURL(from:))
    }

    func acceptToken(_ token: String) {
        tokenInput = token
        saveToken()
    }

    func saveToken() {
        do {
            try credentials.saveToken(tokenInput.trimmingCharacters(in: .whitespacesAndNewlines))
            errorMessage = nil
        } catch {
            errorMessage = "Could not save token to Keychain."
        }
    }

    func clearToken() {
        do {
            try credentials.clearToken()
            tokenInput = ""
            sections = []
            dashboard = nil
            lastRefreshedAt = nil
            errorMessage = nil
        } catch {
            errorMessage = "Could not clear token."
        }
    }

    func refresh() async {
        guard let origin = ServerConfig.normalizeOrigin(serverOrigin) else {
            errorMessage = "Enter a valid Sub2API server URL."
            return
        }
        let token = tokenInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            errorMessage = "Paste an admin Bearer token."
            return
        }

        saveToken()
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let snapshot = try await loader.snapshot(apiBase: ServerConfig.apiBase(from: origin), token: token)
            sections = AccountTransform.groupByGroup(snapshot.accounts)
            dashboard = snapshot.dashboard
            lastRefreshedAt = now()
        } catch WatchdogAPIError.httpStatus(401) {
            errorMessage = "Token expired or unauthorized."
        } catch {
            errorMessage = "Refresh failed: \(error.localizedDescription)"
        }
    }
}
