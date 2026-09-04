package com.sub2api.watchdog.ui

import android.annotation.SuppressLint
import android.graphics.Color
import android.net.Uri
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import com.sub2api.watchdog.WatchdogUiState
import com.sub2api.watchdog.WatchdogViewModel
import com.sub2api.watchdog.core.Account
import com.sub2api.watchdog.core.Appearance
import com.sub2api.watchdog.core.ServerConfig
import com.sub2api.watchdog.core.ThemeKey
import com.sub2api.watchdog.core.WatchdogFormat
import com.sub2api.watchdog.core.WidgetPreferences
import com.sub2api.watchdog.core.WidgetStyle

@Composable fun WatchdogApp(viewModel: WatchdogViewModel) {
    val state by viewModel.state.collectAsState(); var tab by remember { mutableIntStateOf(0) }; var login by remember { mutableStateOf(false) }
    DisposableEffect(Unit) { viewModel.startPolling(); onDispose { viewModel.stopPolling() } }
    val dark = state.preferences.appearance == Appearance.DARK || (state.preferences.appearance == Appearance.SYSTEM && isSystemInDarkTheme())
    val primary = when (state.preferences.theme) { ThemeKey.CLAY -> ComposeColor(0xFF9A4F35); ThemeKey.LATTE -> ComposeColor(0xFF765548); ThemeKey.SAND_SAGE -> ComposeColor(0xFF596748) }
    val scheme = if (dark) darkColorScheme(primary = primary) else lightColorScheme(primary = primary)
    MaterialTheme(colorScheme = scheme) { if (login) LoginPage(ServerConfig.normalizeOrigin(state.origin)?.let(ServerConfig::loginUrl), { token -> if (viewModel.acceptToken(token)) login = false }, { login = false }) else Scaffold(topBar = { Header(state, viewModel::refresh) }, bottomBar = { NavigationBar { listOf("订阅", "用户", "设置").forEachIndexed { index, label -> NavigationBarItem(selected = tab == index, onClick = { tab = index }, icon = { if (index == 2) Icon(Icons.Default.Settings, null) else Text("${index + 1}") }, label = { Text(label) }) } } }) { padding -> Box(Modifier.padding(padding)) { if (!state.configured) Connection(state, viewModel::setOrigin, { login = true }); else when (tab) { 0 -> Subscription(state); 1 -> Users(state); else -> Settings(state.preferences, viewModel::updatePreferences, viewModel::clearSession) } } } }
}

@OptIn(ExperimentalMaterial3Api::class) @Composable private fun Header(state: WatchdogUiState, refresh: () -> Unit) = TopAppBar(title = { Text("Sub2API Watchdog") }, actions = { if (state.loading) CircularProgressIndicator(Modifier.width(22.dp).height(22.dp), strokeWidth = 2.dp) else IconButton(onClick = refresh) { Icon(Icons.Default.Refresh, "刷新") } })
@Composable private fun Connection(state: WatchdogUiState, onOrigin: (String) -> Unit, login: () -> Unit) { var origin by remember(state.origin) { mutableStateOf(state.origin) }; Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) { Text("连接 Sub2API", style = MaterialTheme.typography.headlineSmall); Spacer(Modifier.height(12.dp)); OutlinedTextField(origin, { origin = it; onOrigin(it) }, Modifier.fillMaxWidth(), label = { Text("服务器地址") }, placeholder = { Text("https://your-sub2api.example.com") }); Spacer(Modifier.height(12.dp)); Button(onClick = login, enabled = ServerConfig.normalizeOrigin(origin) != null, modifier = Modifier.fillMaxWidth()) { Text("网页登录") }; state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) } } }
@Composable private fun Subscription(state: WatchdogUiState) = LazyColumn(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { item { Dashboard(state) }; state.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }; if (state.snapshot.updatedAt > 0) item { Text("更新于 ${java.text.DateFormat.getTimeInstance().format(java.util.Date(state.snapshot.updatedAt))}", style = MaterialTheme.typography.labelSmall) }; state.sections.forEach { section -> item { Text(section.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }; items(section.accounts, key = { it.id }) { AccountCard(it) } } }
@Composable private fun Dashboard(state: WatchdogUiState) { val data = state.snapshot.dashboard; Card(Modifier.fillMaxWidth()) { Row(Modifier.padding(14.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Summary("今日 Token", WatchdogFormat.tokens(data?.todayTokens)); Summary("请求", data?.todayRequests?.toString() ?: "—"); Summary("正常", data?.let { "${it.normalAccounts}/${it.totalAccounts ?: "—"}" } ?: "—") } } }
@Composable private fun Summary(label: String, value: String) = Column { Text(value, style = MaterialTheme.typography.titleMedium); Text(label, style = MaterialTheme.typography.labelSmall) }
@Composable private fun AccountCard(account: Account) { val balance = WatchdogFormat.accountBalance(account); val session = com.sub2api.watchdog.core.AccountTransform.sessionUtilization(account); val weekly = com.sub2api.watchdog.core.AccountTransform.weeklyUtilization(account); Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(account.name, style = MaterialTheme.typography.titleMedium); Text(account.platform ?: "其它") }; if (balance != null) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("按量付费余额", style = MaterialTheme.typography.bodySmall); Text(WatchdogFormat.balance(balance.balance, balance.currency), style = MaterialTheme.typography.titleMedium) }; val details = balance.balances.filter { it.currency != balance.currency || it.balance != balance.balance }; if (details.isNotEmpty()) Text(details.joinToString(" · ") { WatchdogFormat.balance(it.balance, it.currency) }, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 7.dp)) } else { Text("会话 ${WatchdogFormat.window(account)}  ${WatchdogFormat.percent(session)}"); androidx.compose.material3.LinearProgressIndicator(progress = { (session ?: 0.0).toFloat() }, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)); Text("7日 ${WatchdogFormat.percent(weekly)}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 7.dp)) }; Text("最近使用 ${WatchdogFormat.lastUsed(account.lastUsedAt)}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 7.dp)) } } }
@Composable private fun Users(state: WatchdogUiState) = LazyColumn(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { item { Text("今日使用用户 ${state.snapshot.userUsage.size}", style = MaterialTheme.typography.titleLarge) }; items(state.snapshot.userUsage, key = { it.id }) { user -> Card(Modifier.fillMaxWidth()) { Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(user.username); Text(WatchdogFormat.lastUsed(user.lastUsedAt), style = MaterialTheme.typography.bodySmall) } } } }
@Composable private fun Settings(value: WidgetPreferences, save: (WidgetPreferences) -> Unit, clear: () -> Unit) = Column(Modifier.fillMaxSize().padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) { Text("外观设置", style = MaterialTheme.typography.titleLarge); Choice("主题", ThemeKey.entries, value.theme, { it.name }, { save(value.copy(theme = it)) }); Choice("外观", Appearance.entries, value.appearance, { when (it) { Appearance.SYSTEM -> "跟随系统"; Appearance.LIGHT -> "浅色"; Appearance.DARK -> "深色" } }, { save(value.copy(appearance = it)) }); Choice("Widget", WidgetStyle.entries, value.widgetStyle, { when (it) { WidgetStyle.RINGS -> "进度环"; WidgetStyle.SEGMENTS -> "分段条"; WidgetStyle.SPOTLIGHT -> "聚光泡" } }, { save(value.copy(widgetStyle = it)) }); Spacer(Modifier.weight(1f)); Button(onClick = clear, modifier = Modifier.fillMaxWidth()) { Text("清除登录态") } }
@Composable private fun <T> Choice(label: String, options: Iterable<T>, selected: T, name: (T) -> String, pick: (T) -> Unit) = Column { Text(label); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { options.forEach { option -> Text(name(option), modifier = Modifier.background(if (option == selected) MaterialTheme.colorScheme.primaryContainer else ComposeColor.Transparent).clickable { pick(option) }.padding(8.dp)) } } }
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LoginPage(url: String?, accepted: (String) -> Unit, close: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("网页登录", style = MaterialTheme.typography.titleLarge)
            Text("关闭", Modifier.clickable(onClick = close))
        }
        if (url == null) {
            Text("请先填写有效服务器地址", Modifier.padding(16.dp))
        } else {
            AndroidView(
                factory = { context ->
                    val allowedOrigin = Uri.parse(url)
                    WebView(context).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        setBackgroundColor(Color.WHITE)
                        val script = "(function(){var r=/eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+/;for(var s of [localStorage,sessionStorage]){for(var i=0;i<s.length;i++){var m=String(s.getItem(s.key(i))||'').match(r);if(m)return m[0]}}return null})()"
                        val scan = object : Runnable {
                            override fun run() {
                                if (!isAttachedToWindow) return
                                evaluateJavascript(script) { raw ->
                                    raw?.trim('\"')?.takeIf { it.isNotBlank() && it != "null" }?.let(accepted)
                                }
                                postDelayed(this, 1500)
                            }
                        }
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                                val target = request.url
                                return target.scheme != allowedOrigin.scheme || target.host != allowedOrigin.host || target.port != allowedOrigin.port
                            }

                            override fun onPageFinished(view: WebView, finishedUrl: String) {
                                super.onPageFinished(view, finishedUrl)
                                view.removeCallbacks(scan)
                                if (Uri.parse(finishedUrl).host == allowedOrigin.host) view.post(scan)
                            }
                        }
                        loadUrl(url)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}
