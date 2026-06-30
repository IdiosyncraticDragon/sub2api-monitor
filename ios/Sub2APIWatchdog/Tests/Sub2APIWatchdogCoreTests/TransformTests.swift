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

        XCTAssertEqual(sections.map(\.name), ["Team A", "Ungrouped"])
        XCTAssertEqual(sections[0].accounts.map(\.id), [1, 3])
        XCTAssertEqual(sections[1].accounts.map(\.id), [2])
    }
}

func sampleAccount(id: Int, status: String = "active", group: String? = "Default") -> Account {
    let groups = group.map { [AccountGroup(id: 10, name: $0, platform: nil, subscriptionType: nil)] }
    return Account(
        id: id,
        name: "Account \(id)",
        status: status,
        platform: "anthropic",
        type: "oauth",
        notes: nil,
        lastUsedAt: nil,
        extra: nil,
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
