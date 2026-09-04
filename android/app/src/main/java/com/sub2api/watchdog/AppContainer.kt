package com.sub2api.watchdog

import android.content.Context
import com.sub2api.watchdog.data.KeystoreCredentialStore
import com.sub2api.watchdog.data.PreferenceStore
import com.sub2api.watchdog.data.SnapshotStore
import com.sub2api.watchdog.data.Sub2ApiRepository
import com.sub2api.watchdog.data.createDatabase

class AppContainer(context: Context) {
    val appContext = context.applicationContext
    val credentials = KeystoreCredentialStore(appContext)
    val preferences = PreferenceStore(appContext)
    val snapshots = SnapshotStore(createDatabase(appContext).snapshots())
    val repository = Sub2ApiRepository(credentials, preferences, snapshots)
}
class WatchdogApplication : android.app.Application() { lateinit var container: AppContainer; override fun onCreate() { super.onCreate(); container = AppContainer(this) } }
