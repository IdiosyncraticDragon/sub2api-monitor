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
            let key = group?.isEmpty == false ? group! : "Ungrouped"
            if buckets[key] == nil {
                order.append(key)
                buckets[key] = []
            }
            buckets[key]?.append(account)
        }

        return order.map { AccountSection(name: $0, accounts: buckets[$0] ?? []) }
    }
}
