package com.sub2api.watchdog.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.Text
import androidx.compose.ui.unit.dp
import com.sub2api.watchdog.MainActivity
import com.sub2api.watchdog.WatchdogApplication
import com.sub2api.watchdog.core.AccountTransform
import com.sub2api.watchdog.core.WatchdogFormat
import com.sub2api.watchdog.core.WidgetPreferences
import com.sub2api.watchdog.core.WidgetStyle
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WatchdogWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val container = (context.applicationContext as WatchdogApplication).container
        val snapshot = container.snapshots.snapshots.first()
        val preferences = container.preferences.widgetPreferences.first()
        provideContent { Content(snapshot, preferences) }
    }
    @Composable private fun Content(snapshot: com.sub2api.watchdog.core.WatchdogSnapshot, preferences: WidgetPreferences) {
        Column(GlanceModifier.fillMaxSize().clickable(actionStartActivity<MainActivity>()).padding(12.dp), verticalAlignment = Alignment.Vertical.Top, horizontalAlignment = Alignment.Horizontal.Start) {
            Text("Sub2API")
            Row(GlanceModifier.fillMaxWidth().padding(top = 6.dp)) { Text("今日 ${WatchdogFormat.tokens(snapshot.dashboard?.todayTokens)}"); Text("  正常 ${snapshot.dashboard?.normalAccounts ?: "—"}") }
            val accounts = AccountTransform.active(snapshot.accounts).sortedByDescending { it.lastUsedAt }.take(5)
            when (preferences.widgetStyle) {
                WidgetStyle.RINGS -> accounts.take(3).forEach { account -> Text("${account.name}  ${WatchdogFormat.percent(AccountTransform.sessionUtilization(account))}") }
                WidgetStyle.SEGMENTS -> Text(accounts.joinToString("  |  ") { WatchdogFormat.percent(AccountTransform.sessionUtilization(it)) })
                WidgetStyle.SPOTLIGHT -> accounts.firstOrNull()?.let { Text("${it.name}  ${WatchdogFormat.percent(AccountTransform.sessionUtilization(it))}") }
            }
            if (snapshot.updatedAt == 0L) Text("打开应用完成登录")
        }
    }
}
class WatchdogWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = WatchdogWidget()
    companion object { fun updateAll(context: Context) { CoroutineScope(Dispatchers.Default).launch { WatchdogWidget().updateAll(context) } } }
}
