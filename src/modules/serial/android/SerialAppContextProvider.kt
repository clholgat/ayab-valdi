package com.snap.modules.serial

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri

/**
 * Captures the process Application Context with no wiring required from the host app.
 * ContentProviders are instantiated by the OS during app startup — before any Activity
 * and before Application.onCreate() finishes — as long as this is declared in the merged
 * manifest, so SerialAppContext.applicationContext is populated before any Valdi module
 * code can run.
 */
class SerialAppContextProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        context?.applicationContext?.let { SerialAppContext.applicationContext = it }
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
}
