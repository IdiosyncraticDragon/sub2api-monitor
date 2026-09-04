package com.sub2api.watchdog.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneOffset

class WatchdogCoreTest {
    @Test fun `normalizes server origin and derives paths`() {
        assertEquals("https://example.test:8443", ServerConfig.normalizeOrigin(" example.test:8443/admin/anything "))
        assertEquals("https://example.test/api/v1", ServerConfig.apiBase("https://example.test"))
        assertEquals("https://example.test/admin/", ServerConfig.loginUrl("https://example.test"))
        assertEquals(null, ServerConfig.normalizeOrigin("not a host"))
    }
    @Test fun `groups only active accounts and uses first group`() {
        val accounts = listOf(Account(1, "B", "active", groups = listOf(AccountGroup(name = "One"))), Account(2, "A", "active"), Account(3, "C", "inactive"))
        assertEquals(listOf("One", "未分组"), AccountTransform.groupByGroup(accounts).map { it.name })
    }
    @Test fun `normalizes anthropic and codex utilization`() {
        assertEquals(0.5, AccountTransform.sessionUtilization(Account(1, "a", "active", platform = "anthropic", extra = AccountExtra(sessionWindowUtilization = 0.5)))!!, 0.001)
        assertEquals(0.8, AccountTransform.weeklyUtilization(Account(2, "b", "active", platform = "codex", extra = AccountExtra(codex7dUsedPercent = 80.0)))!!, 0.001)
    }
    @Test fun `formats DeepSeek pay as you go balance instead of a usage window`() {
        val account = Account(3, "deepseek", "active", platform = "deepseek", extra = AccountExtra(deepseekBalance = 12.3, deepseekBalanceCurrency = "CNY", deepseekBalances = listOf(BalanceEntry("CNY", 12.3), BalanceEntry("USD", 1.5))))
        val balance = WatchdogFormat.accountBalance(account)
        assertEquals("¥12.30", WatchdogFormat.balance(balance?.balance, balance?.currency))
        assertEquals("$1.50", WatchdogFormat.balance(balance?.balances?.last()?.balance, balance?.balances?.last()?.currency))
    }
    @Test fun `rejects refresh and expired jwt`() {
        fun token(payload: String) = "eyJhbGciOiJub25lIn0." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(payload.encodeToByteArray()) + ".signature"
        assertTrue(Jwt.isUsableAccessToken(token("{\"exp\":200}"), 100))
        assertFalse(Jwt.isUsableAccessToken(token("{\"exp\":120,\"token_type\":\"refresh\"}"), 100))
        assertFalse(Jwt.isUsableAccessToken(token("{\"exp\":100}"), 100))
    }
    @Test fun `filters today users in device zone`() {
        val now = Instant.parse("2026-07-13T12:00:00Z")
        val users = listOf(AdminUser(com.google.gson.JsonPrimitive(1), username = "today", lastUsedAt = "2026-07-13T01:00:00Z"), AdminUser(com.google.gson.JsonPrimitive(2), username = "old", lastUsedAt = "2026-07-12T01:00:00Z"))
        assertEquals(listOf("today"), AccountTransform.todayUsers(users, ZoneOffset.UTC, now).map { it.username })
    }
}
