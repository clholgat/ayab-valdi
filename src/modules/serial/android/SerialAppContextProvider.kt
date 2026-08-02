package com.snap.modules.serial

import android.app.Activity
import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager

/**
 * Captures the process Application Context with no wiring required from the host app.
 * ContentProviders are instantiated by the OS during app startup — before any Activity
 * and before Application.onCreate() finishes — as long as this is declared in the merged
 * manifest, so SerialAppContext.applicationContext is populated before any Valdi module
 * code can run.
 */
class SerialAppContextProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        context?.applicationContext?.let { appContext ->
            SerialAppContext.applicationContext = appContext
            (appContext as? Application)?.registerActivityLifecycleCallbacks(
                object : Application.ActivityLifecycleCallbacks {
                    override fun onActivityResumed(activity: Activity) {
                        SerialAppContext.currentActivity = activity
                        SerialAppContext.applyKeepScreenOn(activity)
                    }

                    override fun onActivityPaused(activity: Activity) {
                        if (SerialAppContext.currentActivity === activity) {
                            SerialAppContext.currentActivity = null
                        }
                    }

                    override fun onActivityDestroyed(activity: Activity) {
                        if (SerialAppContext.currentActivity === activity) {
                            SerialAppContext.currentActivity = null
                        }
                    }

                    override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
                    override fun onActivityStarted(activity: Activity) = Unit
                    override fun onActivityStopped(activity: Activity) = Unit
                    override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
                },
            )
        }
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<String>?,
        selection: String?,
        selectionArgs: Array<String>?,
        sortOrder: String?,
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<String>?): Int = 0
    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<String>?,
    ): Int = 0
}

object SerialAppContext {
    @Volatile
    var applicationContext: Context? = null

    @Volatile
    var currentActivity: Activity? = null

    @Volatile
    private var keepScreenOn: Boolean = false

    fun setKeepScreenOn(enabled: Boolean) {
        keepScreenOn = enabled
        currentActivity?.let(::applyKeepScreenOn)
    }

    fun applyKeepScreenOn(activity: Activity) {
        activity.runOnUiThread {
            if (keepScreenOn) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
}
