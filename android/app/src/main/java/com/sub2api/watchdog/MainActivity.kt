package com.sub2api.watchdog

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.sub2api.watchdog.ui.WatchdogApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); enableEdgeToEdge(); setContent { val model = remember { ViewModelProvider(this, Factory((application as WatchdogApplication).container))[WatchdogViewModel::class.java] }; WatchdogApp(model) } }
}
class Factory(private val container: AppContainer) : ViewModelProvider.Factory { @Suppress("UNCHECKED_CAST") override fun <T : ViewModel> create(modelClass: Class<T>): T = WatchdogViewModel(container) as T }
