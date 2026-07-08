import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class WidgetSnapshotStoreTests: XCTestCase {
    func testMakeSnapshotUsesDashboardAndRecentActiveAccounts() {
        let snapshot = WatchdogSnapshot(
            accounts: [
                sampleAccount(id: 1, group: "A", session: 0.2, weekly: 0.1, lastUsedAt: "2026-07-02T09:00:00+08:00"),
                sampleAccount(id: 2, group: "A", session: 0.8, weekly: 0.2, lastUsedAt: "2026-07-02T11:00:00+08:00"),
                sampleAccount(id: 3, group: "A", session: 0.5, weekly: 0.3, lastUsedAt: "2026-07-02T10:00:00+08:00")
            ],
            dashboard: DashboardStats(todayTokens: 1_250, todayRequests: 42, todayCost: 0.75, normalAccounts: 3)
        )

        let widget = WidgetSnapshotStore.makeSnapshot(from: snapshot, updatedAt: Date(timeIntervalSince1970: 10))

        XCTAssertEqual(widget.updatedAt, Date(timeIntervalSince1970: 10))
        XCTAssertEqual(widget.todayTokens, "1.2k")
        XCTAssertEqual(widget.todayRequests, "42")
        XCTAssertEqual(widget.todayCost, "$0.75")
        XCTAssertEqual(widget.normalAccounts, "3")
        XCTAssertEqual(widget.accounts.map(\.id), [2, 3, 1])
        XCTAssertEqual(widget.accounts.first?.session, 0.8)
        XCTAssertEqual(widget.accounts.first?.weekly, 0.2)
    }

    func testSaveLoadAndClearSnapshot() {
        let defaults = UserDefaults(suiteName: "WidgetSnapshotStoreTests.\(UUID().uuidString)")!
        let snapshot = WidgetSnapshot(
            updatedAt: Date(timeIntervalSince1970: 20),
            accounts: [WidgetSnapshotAccount(id: 1, name: "openai", platform: "openai", session: 0.4)],
            todayTokens: "1.0k",
            todayRequests: "12",
            todayCost: "$0.10",
            normalAccounts: "1"
        )

        WidgetSnapshotStore.save(snapshot, defaults: defaults)
        XCTAssertEqual(WidgetSnapshotStore.load(defaults: defaults), snapshot)

        WidgetSnapshotStore.clear(defaults: defaults)
        XCTAssertNil(WidgetSnapshotStore.load(defaults: defaults))
    }

    func testUiPreferencesStoreSavesLoadsAndClears() {
        let defaults = UserDefaults(suiteName: "UiPreferencesStoreTests.\(UUID().uuidString)")!
        let prefs = UiPreferences(theme: .latte, appearance: .dark, widgetStyle: .segments)

        UiPreferencesStore.save(prefs, defaults: defaults)
        XCTAssertEqual(UiPreferencesStore.load(defaults: defaults), prefs)

        UiPreferencesStore.clear(defaults: defaults)
        XCTAssertEqual(UiPreferencesStore.load(defaults: defaults), UiPreferences())
    }
}
