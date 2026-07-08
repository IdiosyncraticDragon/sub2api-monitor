import Foundation

public enum WatchdogFormat {
    public static func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int((value * 100).rounded()))%"
    }

    public static func tokens(_ value: Int?) -> String {
        guard let value else { return "—" }
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
                .replacingOccurrences(of: ".0M", with: "M")
        }
        if value >= 1_000 {
            return String(format: "%.1fk", Double(value) / 1_000)
                .replacingOccurrences(of: ".0k", with: "k")
        }
        return "\(value)"
    }

    public static func cost(_ value: Double?) -> String {
        guard let value else { return "—" }
        return String(format: "$%.2f", value)
    }

    public static func windowRange(start: String?, end: String?) -> String {
        guard
            let start = hhmm(start),
            let end = hhmm(end)
        else { return "—" }
        return "\(start)–\(end)"
    }

    public static func windowRange(account: Account) -> String {
        let explicit = windowRange(start: account.sessionWindowStart, end: account.sessionWindowEnd)
        if explicit != "—" { return explicit }
        return windowRangeFromEnd(account.extra?.codex5hResetAt, durationHours: 5)
    }

    public static func windowRangeFromEnd(_ end: String?, durationHours: Double) -> String {
        guard
            let end = hhmm(end),
            let start = hhmmMinusHours(end, durationHours: durationHours)
        else { return "—" }
        return "\(start)–\(end)"
    }

    public static func lastUsed(_ raw: String?, now: Date = Date()) -> String {
        guard let date = parseDate(raw) else { return "从未使用" }
        let seconds = max(0, Int(now.timeIntervalSince(date)))
        if seconds < 60 { return "刚刚" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)分钟前" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)小时前" }
        return "\(hours / 24)天前"
    }

    public static func sessionUtilization(_ account: Account) -> Double? {
        if AccountTransform.isOpenAIAccount(account) {
            guard let value = account.extra?.codex5hUsedPercent else { return nil }
            return value / 100
        }
        return sessionUtilization(account.extra)
    }

    public static func weeklyUtilization(_ account: Account) -> Double? {
        if AccountTransform.isOpenAIAccount(account) {
            guard let value = account.extra?.codex7dUsedPercent else { return nil }
            return value / 100
        }
        return weeklyUtilization(account.extra)
    }

    public static func sessionUtilization(_ extra: AccountExtra?) -> Double? {
        guard let extra else { return nil }
        if let value = extra.sessionWindowUtilization {
            return value
        }
        if let value = extra.codex5hUsedPercent {
            return value / 100
        }
        return nil
    }

    public static func weeklyUtilization(_ extra: AccountExtra?) -> Double? {
        guard let extra else { return nil }
        if let value = extra.passiveUsage7dUtilization {
            return value
        }
        if let value = extra.codex7dUsedPercent {
            return value / 100
        }
        return nil
    }

    public static func clampedPercentValue(_ value: Double?) -> Double {
        guard let value, !value.isNaN else { return 0 }
        return min(1, max(0, value))
    }

    public static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) {
            return date
        }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    private static func hhmm(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let pattern = #"T(\d{2}):(\d{2})"#
        guard
            let regex = try? NSRegularExpression(pattern: pattern),
            let match = regex.firstMatch(in: iso, range: NSRange(iso.startIndex..<iso.endIndex, in: iso)),
            let hourRange = Range(match.range(at: 1), in: iso),
            let minuteRange = Range(match.range(at: 2), in: iso)
        else {
            return nil
        }
        return "\(iso[hourRange]):\(iso[minuteRange])"
    }

    private static func hhmmMinusHours(_ hhmm: String, durationHours: Double) -> String? {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, durationHours.isFinite else { return nil }
        let minutesInDay = 24 * 60
        let raw = parts[0] * 60 + parts[1] - Int((durationHours * 60).rounded())
        let minutes = ((raw % minutesInDay) + minutesInDay) % minutesInDay
        return "\(String(format: "%02d", minutes / 60)):\(String(format: "%02d", minutes % 60))"
    }
}
