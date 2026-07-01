import Foundation
import SwiftUI
import WidgetKit
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

@MainActor
final class WatchdogViewModel: ObservableObject {
    @AppStorage("serverOrigin") var serverOrigin = ""
    @Published var sections: [AccountSection] = []
    @Published var dashboard: DashboardStats?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastRefreshedAt: Date?
    @Published private(set) var isAuthenticated = false

    private let credentials: CredentialStoring
    private let loader: WatchdogDataLoading
    private let now: @MainActor () -> Date
    private var token: String?

    init(
        credentials: CredentialStoring = KeychainCredentialStore(),
        loader: WatchdogDataLoading = WatchdogRemoteLoader(),
        now: @escaping @MainActor () -> Date = Date.init,
        initialServerOrigin: String? = nil
    ) {
        self.credentials = credentials
        self.loader = loader
        self.now = now
        self.token = credentials.loadToken()
        self.isAuthenticated = self.token?.isEmpty == false
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-reset") {
            self.token = nil
            self.isAuthenticated = false
            self.serverOrigin = ""
            try? credentials.clearToken()
        }
        if let initialServerOrigin {
            self.serverOrigin = initialServerOrigin
        }
    }

    var isConfigured: Bool {
        ServerConfig.normalizeOrigin(serverOrigin) != nil && isAuthenticated
    }

    var loginURL: URL? {
        ServerConfig.normalizeOrigin(serverOrigin).map(ServerConfig.loginURL(from:))
    }

    @discardableResult
    func acceptToken(_ token: String) -> Bool {
        let normalized = token.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try credentials.saveToken(normalized)
            self.token = normalized
            self.isAuthenticated = !normalized.isEmpty
            errorMessage = nil
            return isAuthenticated
        } catch {
            errorMessage = "Could not save login session: \(error.localizedDescription)"
            return false
        }
    }

    func clearToken() {
        do {
            try credentials.clearToken()
            token = nil
            isAuthenticated = false
            sections = []
            dashboard = nil
            WidgetSnapshotStore.clear()
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
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
        guard let token, !token.isEmpty else {
            isAuthenticated = false
            errorMessage = "Sign in with Web Login first."
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let snapshot = try await loader.snapshot(apiBase: ServerConfig.apiBase(from: origin), token: token)
            sections = AccountTransform.groupByGroup(snapshot.accounts)
            dashboard = snapshot.dashboard
            lastRefreshedAt = now()
            WidgetSnapshotStore.save(WidgetSnapshotStore.makeSnapshot(from: snapshot, updatedAt: lastRefreshedAt ?? now()))
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
        } catch WatchdogAPIError.httpStatus(401) {
            errorMessage = "Token expired or unauthorized."
            self.token = nil
            self.isAuthenticated = false
            try? credentials.clearToken()
            WidgetSnapshotStore.clear()
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
        } catch {
            errorMessage = "Refresh failed: \(error.localizedDescription)"
        }
    }
}
