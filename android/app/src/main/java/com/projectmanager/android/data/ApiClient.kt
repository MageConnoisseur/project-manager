package com.projectmanager.android.data

import okhttp3.FormBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class AuthRequiredException : IOException("Sign in again to sync.")

class ApiException(val code: Int, message: String) : IOException(message)

data class ApiResult(val code: Int, val body: String)

class ApiClient(
    val baseUrl: String,
    private val http: OkHttpClient = defaultClient(),
) {
    fun login(email: String, password: String): String {
        val body = FormBody.Builder()
            .add("username", email.trim())
            .add("password", password)
            .add("client", "android")
            .build()
        val result = send("POST", "auth/token", body, token = null, deviceId = null, idempotencyKey = null)
        val json = JSONObject(result.body)
        return json.getString("access_token")
    }

    fun signup(email: String, password: String, displayName: String) {
        val payload = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .put("display_name", displayName.trim())
        sendJson("POST", "auth/signup", payload.toString(), token = null, deviceId = null, idempotencyKey = null)
    }

    fun snapshot(token: String): JSONObject {
        return JSONObject(sendJson("GET", "sync/snapshot", null, token, null, null).body)
    }

    fun changes(token: String, since: Long): JSONObject {
        return JSONObject(sendJson("GET", "sync/changes?since=$since", null, token, null, null).body)
    }

    fun registerDevice(token: String, deviceId: String, fcmToken: String) {
        val payload = JSONObject()
            .put("device_id", deviceId)
            .put("fcm_token", fcmToken)
            .put("platform", "android")
        sendJson("POST", "devices", payload.toString(), token, deviceId, null)
    }

    fun sendJson(
        method: String,
        path: String,
        json: String?,
        token: String?,
        deviceId: String?,
        idempotencyKey: String?,
    ): ApiResult {
        val media = "application/json; charset=utf-8".toMediaType()
        val body = when {
            method == "GET" || method == "HEAD" -> null
            json == null -> ByteArray(0).toRequestBody(null)
            else -> json.toRequestBody(media)
        }
        return send(method, path, body, token, deviceId, idempotencyKey)
    }

    private fun send(
        method: String,
        path: String,
        body: okhttp3.RequestBody?,
        token: String?,
        deviceId: String?,
        idempotencyKey: String?,
    ): ApiResult {
        val builder = Request.Builder().url(baseUrl.trimEnd('/') + "/" + path.trimStart('/'))
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(body ?: ByteArray(0).toRequestBody(null))
            "PUT" -> builder.put(body ?: ByteArray(0).toRequestBody(null))
            "DELETE" -> {
                if (body == null) builder.delete() else builder.delete(body)
            }
            else -> builder.method(method, body)
        }
        if (token != null) {
            builder.header("Authorization", "Bearer $token")
        }
        if (deviceId != null) {
            builder.header("X-Device-Id", deviceId)
        }
        if (idempotencyKey != null) {
            builder.header("Idempotency-Key", idempotencyKey)
        }
        http.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (response.code == 401 && token != null) {
                throw AuthRequiredException()
            }
            if (response.code !in 200..299) {
                throw ApiException(response.code, detailMessage(text, response.code))
            }
            return ApiResult(response.code, text)
        }
    }

    companion object {
        fun normalize(url: String): String {
            val trimmed = url.trim().ifBlank { return "" }
            val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                trimmed
            } else {
                "https://$trimmed"
            }
            return withScheme.trimEnd('/') + "/"
        }

        fun defaultClient(): OkHttpClient {
            return OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build()
        }

        fun detailMessage(body: String, code: Int): String {
            return try {
                val json = JSONObject(body)
                when (val detail = json.opt("detail")) {
                    is String -> detail
                    is JSONArray -> (0 until detail.length()).joinToString(" ") { index ->
                        detail.opt(index).toString()
                    }
                    is JSONObject -> detail.toString()
                    else -> "Request failed ($code)"
                }
            } catch (_: Exception) {
                if (body.isBlank()) "Request failed ($code)" else body
            }
        }
    }
}
