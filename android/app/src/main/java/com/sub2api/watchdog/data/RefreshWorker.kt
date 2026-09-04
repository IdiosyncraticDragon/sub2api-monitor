package com.sub2api.watchdog.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import com.sub2api.watchdog.WatchdogApplication
import com.sub2api.watchdog.widget.WatchdogWidgetReceiver
import java.util.concurrent.TimeUnit

class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = when ((applicationContext as WatchdogApplication).container.repository.refresh()) {
        is RefreshResult.Success -> { WatchdogWidgetReceiver.updateAll(applicationContext); Result.success() }
        is RefreshResult.Unauthorized -> Result.success()
        is RefreshResult.Failure -> Result.retry()
    }
    companion object { fun schedule(context: Context) { WorkManager.getInstance(context).enqueueUniquePeriodicWork("sub2api-background-refresh", ExistingPeriodicWorkPolicy.UPDATE, PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()) } }
}
