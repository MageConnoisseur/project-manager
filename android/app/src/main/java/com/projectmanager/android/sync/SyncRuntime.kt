package com.projectmanager.android.sync

import android.app.Application
import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.projectmanager.android.BuildConfig
import com.projectmanager.android.data.ApiClient
import com.projectmanager.android.data.AppDatabase
import com.projectmanager.android.data.AuthRequiredException
import com.projectmanager.android.data.SessionStore
import com.projectmanager.android.data.TaskRepository
import com.projectmanager.android.logic.SyncGate
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.io.IOException
import java.util.concurrent.TimeUnit

object AppGraph {
    lateinit var session: SessionStore
        private set
    lateinit var repository: TaskRepository
        private set
    val gate = SyncGate()

    fun init(context: Context) {
        if (::repository.isInitialized) {
            return
        }
        val appContext = context.applicationContext
        session = SessionStore(appContext)
        repository = TaskRepository(
            db = AppDatabase.get(appContext),
            api = ApiClient(session.serverUrl(BuildConfig.API_BASE_URL)),
            session = session,
            requestSync = { SyncScheduler.enqueue(appContext) },
        )
    }
}

object SyncScheduler {
    fun enqueue(context: Context) {
        AppGraph.gate.requestAgain()
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "sync-now",
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun ensurePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "sync-periodic",
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }
}

class SyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        AppGraph.init(applicationContext)
        val gate = AppGraph.gate
        if (!gate.tryStart()) {
            return Result.success()
        }
        try {
            do {
                gate.consumeAgain()
                AppGraph.repository.sync()
            } while (gate.consumeAgain())
            return Result.success()
        } catch (_: AuthRequiredException) {
            AppGraph.repository.markNeedsReauth()
            return Result.success()
        } catch (_: IOException) {
            AppGraph.repository.noteOffline()
            return Result.retry()
        } finally {
            gate.finish()
        }
    }
}

class SyncFirebaseService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["type"] == "sync") {
            SyncScheduler.enqueue(this)
        }
    }

    override fun onNewToken(token: String) {
        AppGraph.init(this)
        AppGraph.session.saveFcmToken(token)
        SyncScheduler.enqueue(this)
    }
}

fun startFirebaseIfConfigured(application: Application) {
    val resId = application.resources.getIdentifier("google_app_id", "string", application.packageName)
    if (resId == 0) {
        return
    }
    try {
        if (FirebaseApp.getApps(application).isEmpty()) {
            FirebaseApp.initializeApp(application)
        }
    } catch (_: Exception) {
        // A missing or placeholder google-services file should not block the list.
    }
}
