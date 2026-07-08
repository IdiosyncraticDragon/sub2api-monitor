import XCTest
#if SWIFT_PACKAGE
@testable import Sub2APIWatchdogCore
#endif

final class TransformTests: XCTestCase {
    func testFiltersActiveAccounts() throws {
        let accounts = [
            sampleAccount(id: 1, status: "active"),
            sampleAccount(id: 2, status: "inactive")
        ]

        XCTAssertEqual(AccountTransform.active(accounts).map(\.id), [1])
    }

    func testGroupsByFirstGroupWithUngroupedFallback() throws {
        let accounts = [
            sampleAccount(id: 1, group: "Team A"),
            sampleAccount(id: 2, group: nil),
            sampleAccount(id: 3, group: "Team A")
        ]

        let sections = AccountTransform.groupByGroup(accounts)

        XCTAssertEqual(sections.map(\.name), ["Team A", "未分组"])
        XCTAssertEqual(sections[0].accounts.map(\.id), [1, 3])
        XCTAssertEqual(sections[1].accounts.map(\.id), [2])
    }

    func testRecentActiveAccountsUsesLastUsedDescending() throws {
        let accounts = [
            sampleAccount(id: 1, lastUsedAt: "2026-07-02T09:00:00+08:00"),
            sampleAccount(id: 2, lastUsedAt: nil),
            sampleAccount(id: 3, lastUsedAt: "2026-07-02T11:00:00+08:00"),
            sampleAccount(id: 4, status: "inactive", lastUsedAt: "2026-07-02T12:00:00+08:00")
        ]

        XCTAssertEqual(AccountTransform.recentActiveAccounts(accounts, limit: 2).map(\.id), [3, 1])
    }
}

func sampleAccount(
    id: Int,
    status: String = "active",
    group: String? = "Default",
    session: Double? = nil,
    weekly: Double? = nil,
    platform: String = "anthropic",
    lastUsedAt: String? = nil,
    codex5hResetAt: String? = nil
) -> Account {
    let groups = group.map { [AccountGroup(id: 10, name: $0, platform: nil, subscriptionType: nil)] }
    return Account(
        id: id,
        name: "Account \(id)",
        status: status,
        platform: platform,
        type: "oauth",
        notes: nil,
        lastUsedAt: lastUsedAt,
        extra: (session != nil || weekly != nil || codex5hResetAt != nil) ? (
            AccountExtra(
                sessionWindowUtilization: platform.contains("openai") ? nil : session,
                passiveUsage7dUtilization: platform.contains("openai") ? nil : weekly,
                codex5hUsedPercent: platform.contains("openai") ? session.map { $0 * 100 } : nil,
                codex5hResetAt: codex5hResetAt,
                codex7dUsedPercent: platform.contains("openai") ? weekly.map { $0 * 100 } : nil,
                passiveUsage7dReset: nil,
                passiveUsageSampledAt: nil
            )
        ) : nil,
        sessionWindowStart: nil,
        sessionWindowEnd: nil,
        sessionWindowStatus: nil,
        rateLimitedAt: nil,
        rateLimitResetAt: nil,
        overloadUntil: nil,
        groups: groups,
        concurrency: nil,
        currentConcurrency: nil
    )
}
