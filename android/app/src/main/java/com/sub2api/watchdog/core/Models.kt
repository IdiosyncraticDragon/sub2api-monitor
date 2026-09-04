package com.sub2api.watchdog.core

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

data class ApiEnvelope<T>(val code: Int, val message: String = "", val data: T?)

data class PagedList<T>(
    val items: List<T> = emptyList(),
    val total: Int? = null,
    val page: Int? = null,
    @SerializedName("page_size") val pageSize: Int? = null,
    val pages: Int? = null
)

data class AccountGroup(val id: Int = 0, val name: String = "", val platform: String? = null)
data class BalanceEntry(val currency: String, val balance: Double)
data class AccountExtra(
    @SerializedName("session_window_utilization") val sessionWindowUtilization: Double? = null,
    @SerializedName("passive_usage_7d_utilization") val passiveUsage7dUtilization: Double? = null,
    @SerializedName("codex_5h_used_percent") val codex5hUsedPercent: Double? = null,
    @SerializedName("codex_5h_reset_at") val codex5hResetAt: String? = null,
    @SerializedName("codex_7d_used_percent") val codex7dUsedPercent: Double? = null,
    @SerializedName("codex_7d_reset_at") val codex7dResetAt: String? = null,
    @SerializedName("deepseek_balance") val deepseekBalance: Double? = null,
    @SerializedName("deepseek_balance_currency") val deepseekBalanceCurrency: String? = null,
    @SerializedName("deepseek_balance_available") val deepseekBalanceAvailable: Boolean? = null,
    @SerializedName("deepseek_balances") val deepseekBalances: List<BalanceEntry>? = null
)

data class Account(
    val id: Int,
    val name: String,
    val status: String,
    val platform: String? = null,
    @SerializedName("last_used_at") val lastUsedAt: String? = null,
    val extra: AccountExtra? = null,
    @SerializedName("session_window_start") val sessionWindowStart: String? = null,
    @SerializedName("session_window_end") val sessionWindowEnd: String? = null,
    val groups: List<AccountGroup>? = null
)

data class DashboardStats(
    @SerializedName("today_tokens") val todayTokens: Long = 0,
    @SerializedName("today_requests") val todayRequests: Long = 0,
    @SerializedName("today_cost") val todayCost: Double = 0.0,
    @SerializedName("normal_accounts") val normalAccounts: Int = 0,
    @SerializedName("total_accounts") val totalAccounts: Int? = null
)

data class AdminUser(
    val id: JsonElement,
    val username: String? = null,
    val name: String? = null,
    val email: String? = null,
    @SerializedName("last_used_at") val lastUsedAt: String? = null,
    @SerializedName("last_used") val lastUsed: String? = null,
    @SerializedName("last_used_time") val lastUsedTime: String? = null
)

data class TodayUser(val id: String, val username: String, val lastUsedAt: String)
data class AccountSection(val name: String, val accounts: List<Account>)
data class WatchdogSnapshot(
    val accounts: List<Account> = emptyList(),
    val dashboard: DashboardStats? = null,
    val userUsage: List<TodayUser> = emptyList(),
    val updatedAt: Long = 0
)

enum class ThemeKey { CLAY, LATTE, SAND_SAGE }
enum class Appearance { SYSTEM, LIGHT, DARK }
enum class WidgetStyle { RINGS, SEGMENTS, SPOTLIGHT }
data class WidgetPreferences(val theme: ThemeKey = ThemeKey.CLAY, val appearance: Appearance = Appearance.SYSTEM, val widgetStyle: WidgetStyle = WidgetStyle.RINGS)
