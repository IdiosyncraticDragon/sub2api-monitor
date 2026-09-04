package com.sub2api.watchdog.core

import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max

object ServerConfig {
    fun normalizeOrigin(input: String?): String? {
        return try {
        var value = input?.trim().orEmpty()
        if (value.isEmpty()) return null
        if (!value.startsWith("http://", true) && !value.startsWith("https://", true)) value = "https://$value"
        val uri = URI(value)
        if (uri.host.isNullOrBlank() || uri.scheme !in setOf("http", "https")) null else URI(uri.scheme, null, uri.host, uri.port, null, null, null).toString()
        } catch (_: Exception) { null }
    }
    fun apiBase(origin: String) = "${origin.trimEnd('/')}/api/v1"
    fun loginUrl(origin: String) = "${origin.trimEnd('/')}/admin/"
}

object Jwt {
    private const val SKEW_SECONDS = 60L
    fun isUsableAccessToken(raw: String?, nowSeconds: Long = System.currentTimeMillis() / 1000): Boolean {
        val token = raw?.trim().orEmpty()
        if (!token.matches(Regex("eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+"))) return false
        return try {
            val json = String(java.util.Base64.getUrlDecoder().decode(token.split('.')[1]))
            val exp = Regex("\\\"exp\\\"\\s*:\\s*(\\d+)").find(json)?.groupValues?.get(1)?.toLongOrNull() ?: return false
            val type = Regex("\\\"(?:token_type|type)\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").find(json)?.groupValues?.get(1)
            !type.equals("refresh", true) && exp > nowSeconds + SKEW_SECONDS
        } catch (_: Exception) { false }
    }
}

object AccountTransform {
    fun active(accounts: List<Account>) = accounts.filter { it.status.equals("active", true) }
    fun groupByGroup(accounts: List<Account>): List<AccountSection> = active(accounts)
        .groupBy { it.groups?.firstOrNull { group -> group.name.isNotBlank() }?.name ?: "未分组" }
        .toSortedMap(String.CASE_INSENSITIVE_ORDER).map { AccountSection(it.key, it.value.sortedBy { account -> account.name.lowercase() }) }
    fun isOpenAi(account: Account): Boolean = account.platform.orEmpty().lowercase().let { it.contains("openai") || it.contains("codex") || it.contains("gpt") }
    fun isDeepSeek(account: Account): Boolean = account.platform.orEmpty().lowercase().contains("deepseek")
    fun sessionUtilization(account: Account): Double? {
        val extra = account.extra ?: return null
        val value = if (isOpenAi(account)) extra.codex5hUsedPercent?.div(100) else extra.sessionWindowUtilization ?: extra.codex5hUsedPercent?.div(100)
        return value?.coerceIn(0.0, 1.0)
    }
    fun weeklyUtilization(account: Account): Double? {
        val extra = account.extra ?: return null
        val value = if (isOpenAi(account)) extra.codex7dUsedPercent?.div(100) else extra.passiveUsage7dUtilization ?: extra.codex7dUsedPercent?.div(100)
        return value?.coerceIn(0.0, 1.0)
    }
    fun todayUsers(users: List<AdminUser>, zone: ZoneId = ZoneId.systemDefault(), now: Instant = Instant.now()): List<TodayUser> = users.mapNotNull { user ->
        val date = listOfNotNull(user.lastUsedAt, user.lastUsed, user.lastUsedTime).firstNotNullOfOrNull { parseDate(it) } ?: return@mapNotNull null
        if (date.atZone(zone).toLocalDate() != now.atZone(zone).toLocalDate()) return@mapNotNull null
        TodayUser(user.id.toString().trim('"'), listOf(user.username, user.name, user.email).firstOrNull { !it.isNullOrBlank() } ?: user.id.toString(), date.toString())
    }.sortedByDescending { parseDate(it.lastUsedAt)?.toEpochMilli() ?: 0 }
    fun parseDate(value: String): Instant? = try { Instant.parse(value) } catch (_: Exception) { try { ZonedDateTime.parse(value).toInstant() } catch (_: Exception) { null } }
}

object WatchdogFormat {
    data class AccountBalance(val balance: Double, val currency: String?, val balances: List<BalanceEntry>)
    fun percent(value: Double?) = value?.let { "${(it * 100).toInt()}%" } ?: "—"
    fun tokens(value: Long?) = when { value == null -> "—"; value >= 1_000_000 -> "%.1fM".format(value / 1_000_000.0); value >= 1_000 -> "%.1fk".format(value / 1_000.0); else -> value.toString() }
    fun cost(value: Double?) = value?.let { "$%.2f".format(it) } ?: "—"
    fun balance(value: Double?, currency: String?): String = value?.let {
        when (currency?.trim()?.uppercase()) {
            "CNY" -> "¥%.2f".format(it)
            "USD" -> "$%.2f".format(it)
            null -> "%.2f".format(it)
            else -> "%s %.2f".format(currency.trim().uppercase(), it)
        }
    } ?: "—"
    fun accountBalance(account: Account): AccountBalance? {
        if (!AccountTransform.isDeepSeek(account)) return null
        val extra = account.extra ?: return null
        val balance = extra.deepseekBalance ?: return null
        return AccountBalance(balance, extra.deepseekBalanceCurrency, extra.deepseekBalances.orEmpty())
    }
    fun lastUsed(value: String?): String { val date = value?.let(AccountTransform::parseDate) ?: return "从未使用"; val minutes = max(0, (System.currentTimeMillis() - date.toEpochMilli()) / 60_000); return when { minutes < 1 -> "刚刚"; minutes < 60 -> "${minutes}分钟前"; minutes < 1440 -> "${minutes / 60}小时前"; else -> "${minutes / 1440}天前" } }
    fun window(account: Account): String { val start = account.sessionWindowStart?.let(AccountTransform::parseDate); val end = account.sessionWindowEnd?.let(AccountTransform::parseDate) ?: account.extra?.codex5hResetAt?.let(AccountTransform::parseDate); return if (start != null && end != null) "${DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(start)} - ${DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(end)}" else "—" }
}
