package com.sub2api.watchdog.data

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.sub2api.watchdog.core.Account
import com.sub2api.watchdog.core.AccountExtra
import com.sub2api.watchdog.core.AdminUser
import com.sub2api.watchdog.core.ApiEnvelope
import com.sub2api.watchdog.core.DashboardStats
import com.sub2api.watchdog.core.PagedList
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

class HttpException(val status: Int, message: String) : Exception(message)
interface Sub2Api {
    @GET("admin/accounts") suspend fun accounts(@Query("status") status: String = "active", @Query("page") page: Int = 1, @Query("page_size") pageSize: Int = 100): ApiEnvelope<JsonElement>
    @GET("admin/dashboard/stats") suspend fun dashboard(): ApiEnvelope<JsonElement>
    @GET("admin/users") suspend fun users(@Query("page") page: Int, @Query("page_size") pageSize: Int): ApiEnvelope<JsonElement>
    @GET("admin/accounts/{id}/usage") suspend fun usage(@Path("id") id: Int, @Query("source") source: String, @Query("force") force: Boolean = true): ApiEnvelope<JsonElement>
    @GET("admin/cn-providers/accounts/{id}/balance") suspend fun balance(@Path("id") id: Int): ApiEnvelope<JsonElement>
}
class ApiFactory(private val gson: Gson = Gson()) {
    fun create(apiBase: String, token: String): Sub2Api {
        val auth = Interceptor { chain -> chain.proceed(chain.request().newBuilder().header("Authorization", "Bearer $token").header("Accept", "application/json").build()) }
        return Retrofit.Builder().baseUrl("${apiBase.trimEnd('/')}/").client(OkHttpClient.Builder().addInterceptor(auth).callTimeout(20, TimeUnit.SECONDS).build()).addConverterFactory(GsonConverterFactory.create(gson)).build().create(Sub2Api::class.java)
    }
    fun <T> decode(envelope: ApiEnvelope<JsonElement>, type: Class<T>): T {
        if (envelope.code == 401) throw HttpException(401, envelope.message)
        if (envelope.code != 0 || envelope.data == null) throw HttpException(envelope.code, envelope.message.ifBlank { "API request failed" })
        return gson.fromJson(envelope.data, type)
    }
    fun <T> decodeList(envelope: ApiEnvelope<JsonElement>, element: Class<T>): PagedList<T> {
        if (envelope.code == 401) throw HttpException(401, envelope.message)
        if (envelope.code != 0 || envelope.data == null) throw HttpException(envelope.code, envelope.message)
        val data = envelope.data
        if (data.isJsonArray) return PagedList(data.asJsonArray.map { gson.fromJson(it, element) })
        val obj = data.asJsonObject
        return PagedList(obj.getAsJsonArray("items")?.map { gson.fromJson(it, element) } ?: emptyList(), obj.get("total")?.asInt, obj.get("page")?.asInt, obj.get("page_size")?.asInt, obj.get("pages")?.asInt)
    }
    fun usageExtra(value: JsonElement, source: String): AccountExtra {
        fun number(vararg keys: String) = keys.firstNotNullOfOrNull { key -> value.find(key)?.asDouble }
        fun string(vararg keys: String) = keys.firstNotNullOfOrNull { key -> value.find(key)?.asString }
        return if (source == "active") AccountExtra(codex5hUsedPercent = number("codex_5h_used_percent", "used_percent", "usage_percent", "percent"), codex5hResetAt = string("codex_5h_reset_at", "reset_at", "resets_at")) else AccountExtra(codex7dUsedPercent = number("codex_7d_used_percent", "used_percent", "usage_percent", "percent"), codex7dResetAt = string("codex_7d_reset_at", "reset_at", "resets_at"))
    }
    fun balanceExtra(value: JsonElement): AccountExtra {
        val root = value.asJsonObject
        val balances = root.getAsJsonArray("balances")?.mapNotNull { entry ->
            val item = entry.takeIf { it.isJsonObject }?.asJsonObject ?: return@mapNotNull null
            val currency = item.get("currency")?.takeIf { it.isJsonPrimitive }?.asString ?: return@mapNotNull null
            val balance = item.get("balance")?.takeIf { it.isJsonPrimitive }?.asDouble ?: return@mapNotNull null
            com.sub2api.watchdog.core.BalanceEntry(currency, balance)
        }
        return AccountExtra(
            deepseekBalance = root.get("balance")?.takeIf { it.isJsonPrimitive }?.asDouble,
            deepseekBalanceCurrency = root.get("currency")?.takeIf { it.isJsonPrimitive }?.asString,
            deepseekBalanceAvailable = root.get("available")?.takeIf { it.isJsonPrimitive }?.asBoolean,
            deepseekBalances = balances
        )
    }
    private fun JsonElement.find(key: String): JsonElement? = when { isJsonObject -> asJsonObject.get(key) ?: asJsonObject.entrySet().firstNotNullOfOrNull { it.value.find(key) }; isJsonArray -> asJsonArray.firstNotNullOfOrNull { it.find(key) }; else -> null }
}
