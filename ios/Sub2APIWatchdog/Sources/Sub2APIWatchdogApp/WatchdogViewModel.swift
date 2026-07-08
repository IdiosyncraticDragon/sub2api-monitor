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
    @Published var userUsage: UserUsageSummary?
    @Published var uiPrefs = UiPreferences()
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastRefreshedAt: Date?
    @Published private(set) var isAuthenticated = false

    private let credentials: CredentialStoring
    private let loader: WatchdogDataLoading
    private let now: @MainActor () -> Date
    private var token: String?
    private var autoRefreshTask: Task<Void, Never>?

    init(
        credentials: CredentialStoring = KeychainCredentialStore(),
        loader: WatchdogDataLoading = WatchdogRemoteLoader(),
        now: @escaping @MainActor () -> Date = Date.init,
        initialServerOrigin: String? = nil
    ) {
        self.credentials = credentials
        self.loader = loader
        self.now = now
        self.uiPrefs = UiPreferencesStore.load()
        if let token = credentials.loadToken(), JWTScanner.isUsableAccessToken(token, now: now()) {
            self.token = token
            self.isAuthenticated = true
        } else {
            self.token = nil
            self.isAuthenticated = false
            try? credentials.clearToken()
        }
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-reset") {
            self.token = nil
            self.isAuthenticated = false
            self.serverOrigin = ""
            self.uiPrefs = UiPreferences()
            UiPreferencesStore.clear()
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
        guard JWTScanner.isUsableAccessToken(normalized, now: now()) else {
            errorMessage = "未找到有效的登录凭证，请确认网页登录已完成。"
            return false
        }
        do {
            try credentials.saveToken(normalized)
            self.token = normalized
            self.isAuthenticated = !normalized.isEmpty
            errorMessage = nil
            return isAuthenticated
        } catch {
            errorMessage = "无法保存登录态：\(error.localizedDescription)"
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
            userUsage = nil
            WidgetSnapshotStore.clear()
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
            lastRefreshedAt = nil
            errorMessage = nil
        } catch {
            errorMessage = "无法清除登录态。"
        }
    }

    func setUiPreferences(_ prefs: UiPreferences) {
        uiPrefs = prefs
        UiPreferencesStore.save(prefs)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
    }

    func startAutoRefresh() {
        guard autoRefreshTask == nil else { return }
        autoRefreshTask = Task { [weak self] in
            var currentDelay: UInt64 = 30
            while !Task.isCancelled {
                guard let self else { return }
                if self.isConfigured {
                    let success = await self.refresh(silent: true)
                    let sleepSeconds = success ? 30 : currentDelay
                    currentDelay = success ? 30 : min(120, currentDelay * 2)
                    try? await Task.sleep(nanoseconds: sleepSeconds * 1_000_000_000)
                } else {
                    currentDelay = 30
                    try? await Task.sleep(nanoseconds: 30 * 1_000_000_000)
                }
            }
        }
    }

    func stopAutoRefresh() {
        autoRefreshTask?.cancel()
        autoRefreshTask = nil
    }

    @discardableResult
    func refresh() async -> Bool {
        await refresh(silent: false)
    }

    @discardableResult
    private func refresh(silent: Bool) async -> Bool {
        guard let origin = ServerConfig.normalizeOrigin(serverOrigin) else {
            if !silent { errorMessage = "请输入有效的 Sub2API 服务器地址。" }
            return false
        }
        guard let token, !token.isEmpty else {
            isAuthenticated = false
            if !silent { errorMessage = "请先使用网页登录。" }
            return false
        }
        guard !isLoading else { return true }

        isLoading = true
        if !silent { errorMessage = nil }
        defer { isLoading = false }

        do {
            let snapshot = try await loader.snapshot(apiBase: ServerConfig.apiBase(from: origin), token: token)
            sections = AccountTransform.groupByGroup(snapshot.accounts)
            if let snapshotDashboard = snapshot.dashboard {
                dashboard = snapshotDashboard
            }
            if let snapshotUserUsage = snapshot.userUsage {
                userUsage = snapshotUserUsage
            }
            lastRefreshedAt = now()
            WidgetSnapshotStore.save(
                WidgetSnapshotStore.makeSnapshot(
                    from: WatchdogSnapshot(accounts: snapshot.accounts, dashboard: dashboard, userUsage: userUsage),
                    updatedAt: lastRefreshedAt ?? now()
                )
            )
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
            errorMessage = nil
            return true
        } catch WatchdogAPIError.httpStatus(let status) where status == 401 {
            errorMessage = "登录凭证已过期，请重新登录。"
            self.token = nil
            self.isAuthenticated = false
            try? credentials.clearToken()
            WidgetSnapshotStore.clear()
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetSnapshotConfig.widgetKind)
            return false
        } catch {
            if !silent {
                errorMessage = "刷新失败：\(error.localizedDescription)"
            }
            return false
        }
    }

    deinit {
        autoRefreshTask?.cancel()
    }
}
