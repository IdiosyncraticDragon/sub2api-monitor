import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogApp
@testable import Sub2APIWatchdogCore
#endif

@MainActor
final class WatchdogViewModelTests: XCTestCase {
    func testRefreshLoadsDashboardAndGroupedAccounts() async {
        let token = validAccessToken()
        let credentials = MemoryCredentials()
        let loader = FakeLoader(snapshot: WatchdogSnapshot(
            accounts: [
                sampleAccount(id: 1, group: "Claude"),
                sampleAccount(id: 2, group: "Claude")
            ],
            dashboard: DashboardStats(todayTokens: 1200, todayRequests: 12, todayCost: 0.5, normalAccounts: 2),
            userUsage: UserUsageSummary(count: 1, users: [TodayUser(id: "1", username: "alice", lastUsedAt: "2026-07-02T09:00:00+08:00")])
        ))
        let date = Date(timeIntervalSince1970: 100)
        let model = WatchdogViewModel(credentials: credentials, loader: loader, now: { date }, initialServerOrigin: "agent.example.com")
        model.acceptToken(" \(token) ")

        await model.refresh()

        XCTAssertNil(model.errorMessage)
        XCTAssertEqual(credentials.savedToken, token)
        XCTAssertEqual(model.sections.map(\.name), ["Claude"])
        XCTAssertEqual(model.sections.first?.accounts.count, 2)
        XCTAssertEqual(model.dashboard?.todayTokens, 1200)
        XCTAssertEqual(model.userUsage?.count, 1)
        XCTAssertEqual(model.lastRefreshedAt, date)
        XCTAssertEqual(loader.lastAPIBase?.absoluteString, "https://agent.example.com/api/v1")
        XCTAssertEqual(loader.lastToken, token)
    }

    func testRefreshRequiresValidOriginAndToken() async {
        let model = WatchdogViewModel(credentials: MemoryCredentials(), loader: FakeLoader(), initialServerOrigin: "")

        await model.refresh()
        XCTAssertEqual(model.errorMessage, "请输入有效的 Sub2API 服务器地址。")

        model.serverOrigin = "agent.example.com"
        await model.refresh()
        XCTAssertEqual(model.errorMessage, "请先使用网页登录。")
    }

    func testRefreshHandlesUnauthorized() async {
        let model = WatchdogViewModel(
            credentials: MemoryCredentials(),
            loader: FakeLoader(error: WatchdogAPIError.httpStatus(401)),
            initialServerOrigin: "agent.example.com"
        )
        model.acceptToken(validAccessToken())

        await model.refresh()

        XCTAssertEqual(model.errorMessage, "登录凭证已过期，请重新登录。")
        XCTAssertNil(model.dashboard)
    }

    func testClearTokenClearsLoadedState() {
        let credentials = MemoryCredentials(initialToken: "abc")
        let model = WatchdogViewModel(credentials: credentials, loader: FakeLoader(), initialServerOrigin: "")
        model.sections = [AccountSection(name: "A", accounts: [sampleAccount(id: 1)])]
        model.dashboard = DashboardStats(todayTokens: 1, todayRequests: 1, todayCost: 1, normalAccounts: 1)
        model.userUsage = UserUsageSummary(count: 1, users: [TodayUser(id: "1", username: "alice", lastUsedAt: "2026-07-02T09:00:00+08:00")])
        model.lastRefreshedAt = Date()
        model.errorMessage = "old"

        model.clearToken()

        XCTAssertFalse(model.isAuthenticated)
        XCTAssertTrue(model.sections.isEmpty)
        XCTAssertNil(model.dashboard)
        XCTAssertNil(model.userUsage)
        XCTAssertNil(model.lastRefreshedAt)
        XCTAssertNil(model.errorMessage)
        XCTAssertTrue(credentials.didClear)
    }

    func testAcceptTokenSavesScannedLoginToken() {
        let token = validAccessToken()
        let credentials = MemoryCredentials()
        let model = WatchdogViewModel(credentials: credentials, loader: FakeLoader(), initialServerOrigin: "agent.example.com")

        XCTAssertTrue(model.acceptToken(token))

        XCTAssertTrue(model.isAuthenticated)
        XCTAssertEqual(credentials.savedToken, token)
        XCTAssertEqual(model.loginURL?.absoluteString, "https://agent.example.com/admin")
    }

    func testAcceptTokenReportsSaveFailure() {
        let credentials = MemoryCredentials(saveError: KeychainError(status: errSecInteractionNotAllowed))
        let model = WatchdogViewModel(credentials: credentials, loader: FakeLoader(), initialServerOrigin: "agent.example.com")

        XCTAssertFalse(model.acceptToken(validAccessToken()))

        XCTAssertFalse(model.isAuthenticated)
        XCTAssertEqual(model.errorMessage, "无法保存登录态：Keychain OSStatus \(errSecInteractionNotAllowed)")
    }

    func testAcceptTokenRejectsExpiredOrRefreshToken() {
        let model = WatchdogViewModel(
            credentials: MemoryCredentials(),
            loader: FakeLoader(),
            now: { Date(timeIntervalSince1970: 1_700_000_000) },
            initialServerOrigin: "agent.example.com"
        )

        XCTAssertFalse(model.acceptToken(testJWT(exp: 1_700_000_030)))

        XCTAssertFalse(model.isAuthenticated)
        XCTAssertEqual(model.errorMessage, "未找到有效的登录凭证，请确认网页登录已完成。")
    }

    func testSetUiPreferencesPersistsSelection() {
        let model = WatchdogViewModel(credentials: MemoryCredentials(), loader: FakeLoader(), initialServerOrigin: "")
        let prefs = UiPreferences(theme: .latte, appearance: .dark, widgetStyle: .spotlight)

        model.setUiPreferences(prefs)

        XCTAssertEqual(model.uiPrefs, prefs)
        XCTAssertEqual(UiPreferencesStore.load(), prefs)
        UiPreferencesStore.clear()
    }
}

final class MemoryCredentials: CredentialStoring, @unchecked Sendable {
    private let initialToken: String?
    private let saveError: Error?
    private(set) var savedToken: String?
    private(set) var didClear = false

    init(initialToken: String? = nil, saveError: Error? = nil) {
        self.initialToken = initialToken
        self.saveError = saveError
    }

    func loadToken() -> String? {
        initialToken
    }

    func saveToken(_ token: String) throws {
        if let saveError {
            throw saveError
        }
        savedToken = token
    }

    func clearToken() throws {
        didClear = true
    }
}

final class FakeLoader: WatchdogDataLoading, @unchecked Sendable {
    private let result: Result<WatchdogSnapshot, Error>
    private(set) var lastAPIBase: URL?
    private(set) var lastToken: String?

    init(snapshot: WatchdogSnapshot = WatchdogSnapshot(accounts: [], dashboard: DashboardStats(todayTokens: 0, todayRequests: 0, todayCost: 0, normalAccounts: 0))) {
        self.result = .success(snapshot)
    }

    init(error: Error) {
        self.result = .failure(error)
    }

    func snapshot(apiBase: URL, token: String) async throws -> WatchdogSnapshot {
        lastAPIBase = apiBase
        lastToken = token
        return try result.get()
    }
}

private func validAccessToken() -> String {
    testJWT(exp: 4_000_000_000)
}
