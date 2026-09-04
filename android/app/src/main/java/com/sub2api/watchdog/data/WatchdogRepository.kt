package com.sub2api.watchdog.data

import com.sub2api.watchdog.core.Account
import com.sub2api.watchdog.core.AccountExtra
import com.sub2api.watchdog.core.AccountTransform
import com.sub2api.watchdog.core.DashboardStats
import com.sub2api.watchdog.core.ServerConfig
import com.sub2api.watchdog.core.TodayUser
import com.sub2api.watchdog.core.WatchdogSnapshot
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first

sealed interface RefreshResult { data class Success(val snapshot: WatchdogSnapshot) : RefreshResult; data object Unauthorized : RefreshResult; data class Failure(val message: String) : RefreshResult }

class Sub2ApiRepository(
    private val credentials: CredentialStore,
    private val preferences: PreferenceStore,
    private val snapshots: SnapshotStore,
    private val apiFactory: ApiFactory = ApiFactory()
) {
    suspend fun refresh(): RefreshResult {
        val origin = ServerConfig.normalizeOrigin(preferences.originFlow.firstValue()) ?: return RefreshResult.Failure("请输入有效的 Sub2API 服务器地址。")
        val token = credentials.loadAccessToken() ?: return RefreshResult.Unauthorized
        return try {
            val api = apiFactory.create(ServerConfig.apiBase(origin), token)
            val snapshot = coroutineScope {
                val accountsDeferred = async { apiFactory.decodeList(api.accounts(), Account::class.java).items }
                val dashboardDeferred = async { runCatching { apiFactory.decode(api.dashboard(), DashboardStats::class.java) }.getOrNull() }
                val usersDeferred = async { loadTodayUsers(api) }
                val baseAccounts = AccountTransform.active(accountsDeferred.await())
                val enriched = baseAccounts.map { account -> async { enrichAccountUsage(api, account) } }.map { it.await() }
                WatchdogSnapshot(enriched, dashboardDeferred.await(), usersDeferred.await(), System.currentTimeMillis())
            }
            snapshots.save(snapshot)
            RefreshResult.Success(snapshot)
        } catch (error: HttpException) {
            if (error.status == 401) { credentials.clear(); snapshots.clear(); RefreshResult.Unauthorized } else RefreshResult.Failure(error.message ?: "刷新失败")
        } catch (error: Exception) { RefreshResult.Failure(error.message ?: "刷新失败") }
    }
    suspend fun clearSession() { credentials.clear(); snapshots.clear() }
    private suspend fun enrichAccountUsage(api: Sub2Api, account: Account): Account {
        if (!AccountTransform.isOpenAi(account) && !AccountTransform.isDeepSeek(account)) return account
        return try {
            if (AccountTransform.isDeepSeek(account)) {
                val balance = apiFactory.balanceExtra(apiFactory.decode(api.balance(account.id), com.google.gson.JsonElement::class.java))
                return account.copy(extra = account.extra?.copy(
                    deepseekBalance = balance.deepseekBalance,
                    deepseekBalanceCurrency = balance.deepseekBalanceCurrency,
                    deepseekBalanceAvailable = balance.deepseekBalanceAvailable,
                    deepseekBalances = balance.deepseekBalances
                ) ?: balance)
            }
            coroutineScope {
                val active = async { apiFactory.usageExtra(apiFactory.decode(api.usage(account.id, "active"), com.google.gson.JsonElement::class.java), "active") }
                val passive = async { apiFactory.usageExtra(apiFactory.decode(api.usage(account.id, "passive"), com.google.gson.JsonElement::class.java), "passive") }
                val left = active.await(); val right = passive.await(); account.copy(extra = account.extra?.copy(codex5hUsedPercent = left.codex5hUsedPercent, codex5hResetAt = left.codex5hResetAt, codex7dUsedPercent = right.codex7dUsedPercent, codex7dResetAt = right.codex7dResetAt) ?: AccountExtra(codex5hUsedPercent = left.codex5hUsedPercent, codex5hResetAt = left.codex5hResetAt, codex7dUsedPercent = right.codex7dUsedPercent, codex7dResetAt = right.codex7dResetAt))
            }
        } catch (error: HttpException) { if (error.status == 401) throw error; account } catch (_: Exception) { account }
    }
    private suspend fun loadTodayUsers(api: Sub2Api): List<TodayUser> {
        val all = mutableListOf<com.sub2api.watchdog.core.AdminUser>(); var page = 1
        while (true) { val batch = apiFactory.decodeList(api.users(page, 100), com.sub2api.watchdog.core.AdminUser::class.java); all += batch.items; if (batch.items.isEmpty() || batch.pages?.let { page >= it } == true || batch.total?.let { all.size >= it } == true) break; page++ }
        return AccountTransform.todayUsers(all)
    }
}

private suspend fun <T> kotlinx.coroutines.flow.Flow<T>.firstValue(): T = this.first()
