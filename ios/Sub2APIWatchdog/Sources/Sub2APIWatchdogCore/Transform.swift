import Foundation

public enum AccountTransform {
    public static func active(_ accounts: [Account]) -> [Account] {
        accounts.filter { $0.status == "active" }
    }

    public static func groupByGroup(_ accounts: [Account]) -> [AccountSection] {
        var order: [String] = []
        var buckets: [String: [Account]] = [:]

        for account in accounts {
            let group = account.groups?.first?.name.trimmingCharacters(in: .whitespacesAndNewlines)
            let key = group?.isEmpty == false ? group! : "未分组"
            if buckets[key] == nil {
                order.append(key)
                buckets[key] = []
            }
            buckets[key]?.append(account)
        }

        return order.map { AccountSection(name: $0, accounts: buckets[$0] ?? []) }
    }

    public static func isOpenAIAccount(_ account: Account) -> Bool {
        let platform = (account.platform ?? "").lowercased()
        return platform.contains("openai") || platform.contains("codex") || platform.contains("gpt")
    }

    public static func recentActiveAccounts(_ accounts: [Account], limit: Int) -> [Account] {
        guard limit > 0 else { return [] }
        return accounts
            .filter { account in
                guard account.status == "active", let raw = account.lastUsedAt else { return false }
                return WatchdogFormat.parseDate(raw) != nil
            }
            .sorted { lhs, rhs in
                let left = WatchdogFormat.parseDate(lhs.lastUsedAt)?.timeIntervalSince1970 ?? 0
                let right = WatchdogFormat.parseDate(rhs.lastUsedAt)?.timeIntervalSince1970 ?? 0
                return left > right
            }
            .prefix(limit)
            .map { $0 }
    }
}
