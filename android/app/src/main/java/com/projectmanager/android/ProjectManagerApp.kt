package com.projectmanager.android

import android.app.Application
import com.projectmanager.android.sync.AppGraph
import com.projectmanager.android.sync.SyncScheduler
import com.projectmanager.android.sync.startFirebaseIfConfigured

class ProjectManagerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.init(this)
        startFirebaseIfConfigured(this)
        SyncScheduler.ensurePeriodic(this)
        if (AppGraph.session.token() != null) {
            SyncScheduler.enqueue(this)
        }
    }
}
