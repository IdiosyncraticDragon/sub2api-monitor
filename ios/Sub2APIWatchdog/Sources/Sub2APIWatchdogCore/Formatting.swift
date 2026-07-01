import Foundation

public enum WatchdogFormat {
    public static func percent(_ value: Double?) -> String {
        guard let value else { return "-" }
        return "\(Int((value * 100).rounded()))%"
    }

    public static func tokens(_ value: Int) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
        }
        if value >= 1_000 {
            return String(format: "%.1fk", Double(value) / 1_000)
        }
        return "\(value)"
    }

    public static func cost(_ value: Double) -> String {
        String(format: "$%.2f", value)
    }

    public static func windowRange(start: String?, end: String?) -> String {
        guard
            let startDate = parseDate(start),
            let endDate = parseDate(end)
        else { return "-" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return "\(formatter.string(from: startDate))-\(formatter.string(from: endDate))"
    }

    public static func lastUsed(_ raw: String?, now: Date = Date()) -> String {
        guard let date = parseDate(raw) else { return "Never" }
        let seconds = max(0, Int(now.timeIntervalSince(date)))
        if seconds < 60 { return "Just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        return "\(hours / 24)d ago"
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

    private static func parseDate(_ raw: String?) -> Date? {
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
}
