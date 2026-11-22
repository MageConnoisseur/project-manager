package com.projectmanager.android.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONObject
import java.util.UUID

class SessionStore(context: Context) {
    private val prefs = openPrefs(context.applicationContext)

    fun token(): String? = prefs.getString(KEY_TOKEN, null)

    fun tokenIfValid(nowEpochSeconds: Long = System.currentTimeMillis() / 1000): String? {
        val value = token() ?: return null
        val exp = jwtExp(value) ?: return value
        return if (exp > nowEpochSeconds) value else null
    }

    fun hasExpiredToken(nowEpochSeconds: Long = System.currentTimeMillis() / 1000): Boolean {
        val value = token() ?: return false
        val exp = jwtExp(value) ?: return false
        return exp <= nowEpochSeconds
    }

    fun saveSession(token: String, serverUrl: String) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER, jwtSubject(token))
            .putString(KEY_SERVER, serverUrl)
            .apply()
    }

    fun userId(): String? = prefs.getString(KEY_USER, null)

    fun clearSession() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
    }

    fun serverUrl(defaultUrl: String): String {
        return prefs.getString(KEY_SERVER, null)?.takeIf { it.isNotBlank() } ?: defaultUrl
    }

    fun saveServer(url: String) {
        prefs.edit().putString(KEY_SERVER, url.trim()).apply()
    }

    fun deviceId(): String {
        val existing = prefs.getString(KEY_DEVICE, null)
        if (existing != null) {
            return existing
        }
        val created = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_DEVICE, created).apply()
        return created
    }

    fun fcmToken(): String? = prefs.getString(KEY_FCM, null)

    fun saveFcmToken(token: String) {
        prefs.edit().putString(KEY_FCM, token).apply()
    }

    private fun openPrefs(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                "session",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (_: Exception) {
            context.getSharedPreferences("session-plain", Context.MODE_PRIVATE)
        }
    }

    companion object {
        private const val KEY_TOKEN = "token"
        private const val KEY_USER = "user"
        private const val KEY_SERVER = "server"
        private const val KEY_DEVICE = "device"
        private const val KEY_FCM = "fcm"

        fun jwtExp(token: String): Long? = jwtPayload(token)?.optLong("exp")?.takeIf { it > 0 }

        fun jwtSubject(token: String): String? = jwtPayload(token)?.optString("sub")?.takeIf { it.isNotBlank() }

        private fun jwtPayload(token: String): JSONObject? {
            val parts = token.split(".")
            if (parts.size < 2) {
                return null
            }
            return try {
                val padded = parts[1].replace('-', '+').replace('_', '/')
                val bytes = Base64.decode(padded, Base64.DEFAULT)
                JSONObject(String(bytes, Charsets.UTF_8))
            } catch (_: Exception) {
                null
            }
        }
    }
}
