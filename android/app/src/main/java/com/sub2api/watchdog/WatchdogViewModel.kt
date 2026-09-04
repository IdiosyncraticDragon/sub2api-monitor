package com.sub2api.watchdog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sub2api.watchdog.core.AccountSection
import com.sub2api.watchdog.core.AccountTransform
import com.sub2api.watchdog.core.Jwt
import com.sub2api.watchdog.core.ServerConfig
import com.sub2api.watchdog.core.WidgetPreferences
import com.sub2api.watchdog.core.WatchdogSnapshot
import com.sub2api.watchdog.data.RefreshResult
import com.sub2api.watchdog.data.RefreshWorker
import com.sub2api.watchdog.widget.WatchdogWidgetReceiver
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class WatchdogUiState(val origin: String = "", val snapshot: WatchdogSnapshot = WatchdogSnapshot(), val preferences: WidgetPreferences = WidgetPreferences(), val authenticated: Boolean = false, val loading: Boolean = false, val error: String? = null) {
    val configured get() = ServerConfig.normalizeOrigin(origin) != null && authenticated
    val sections: List<AccountSection> get() = AccountTransform.groupByGroup(snapshot.accounts)
}

class WatchdogViewModel(private val container: AppContainer) : ViewModel() {
    private val loading = MutableStateFlow(false); private val error = MutableStateFlow<String?>(null); private val authenticated = MutableStateFlow(false); private var polling: Job? = null
    private val snapshotState = combine(
        container.preferences.originFlow,
        container.snapshots.snapshots,
        container.preferences.widgetPreferences
    ) { origin, snapshot, preferences -> Triple(origin, snapshot, preferences) }
    val state: StateFlow<WatchdogUiState> = combine(snapshotState, loading, error, authenticated) { snapshotState, isLoading, failure, signedIn ->
        WatchdogUiState(snapshotState.first, snapshotState.second, snapshotState.third, signedIn, isLoading, failure)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), WatchdogUiState())
    init { viewModelScope.launch { authenticated.value = container.credentials.loadAccessToken()?.let(Jwt::isUsableAccessToken) == true } }
    fun setOrigin(value: String) = viewModelScope.launch { container.preferences.setOrigin(value); error.value = null }
    fun acceptToken(token: String): Boolean { if (!Jwt.isUsableAccessToken(token)) { error.value = "未找到有效的登录凭证，请确认网页登录已完成。"; return false }; viewModelScope.launch { container.credentials.saveAccessToken(token); authenticated.value = true; RefreshWorker.schedule(container.appContext); refresh() }; return true }
    fun refresh() = viewModelScope.launch { loading.value = true; error.value = null; when (val result = container.repository.refresh()) { is RefreshResult.Success -> { authenticated.value = true; RefreshWorker.schedule(container.appContext) }; RefreshResult.Unauthorized -> { authenticated.value = false; error.value = "登录凭证已过期，请重新登录。" }; is RefreshResult.Failure -> error.value = result.message }; loading.value = false }
    fun clearSession() = viewModelScope.launch { container.repository.clearSession(); authenticated.value = false; error.value = null }
    fun updatePreferences(value: WidgetPreferences) = viewModelScope.launch { container.preferences.setPreferences(value); WatchdogWidgetReceiver.updateAll(container.appContext) }
    fun startPolling() { if (polling != null) return; polling = viewModelScope.launch { var wait = 0L; var backoff = 30_000L; while (true) { delay(wait); val result = container.repository.refresh(); wait = if (result is RefreshResult.Success) { backoff = 30_000; 30_000 } else { val next = backoff; backoff = (backoff * 2).coerceAtMost(120_000); next } } } }
    fun stopPolling() { polling?.cancel(); polling = null }
}
