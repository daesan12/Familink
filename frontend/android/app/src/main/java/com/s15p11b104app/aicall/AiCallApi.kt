package com.s15p11b104app.aicall

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONException
import org.json.JSONObject

internal enum class AiCallConnectionResult(val wireValue: String) {
  Connected("CONNECTED"),
  Failed("FAILED"),
}

internal enum class AiCallTerminationType(val wireValue: String) {
  UserRequested("USER_REQUESTED"),
  ConnectionLost("CONNECTION_LOST"),
}

internal data class CreatedAiCallSession(
    val callSessionId: Long,
    val sdpAnswer: String,
)

internal interface AiCallSessionClient {
  suspend fun createCallSession(
      accessToken: String,
      personaId: Long,
      sdpOffer: String,
  ): CreatedAiCallSession

  suspend fun reportConnectionResult(
      accessToken: String,
      callSessionId: Long,
      result: AiCallConnectionResult,
      errorCode: String? = null,
  ): Long

  suspend fun endCallSession(
      accessToken: String,
      callSessionId: Long,
      terminationType: AiCallTerminationType,
  ): Long
}

internal class AiCallApiException(
    val statusCode: Int? = null,
    val errorCode: String,
    override val message: String,
    cause: Throwable? = null,
) : IOException(message, cause)

internal class HttpAiCallSessionClient(
    baseUrl: String,
    private val httpClient: OkHttpClient = defaultHttpClient,
) : AiCallSessionClient {

  private val baseUrl = baseUrl.trim().trimEnd('/')

  override suspend fun createCallSession(
      accessToken: String,
      personaId: Long,
      sdpOffer: String,
  ): CreatedAiCallSession =
      withContext(Dispatchers.IO) {
        val body =
            JSONObject()
                .put("persona_id", personaId)
                .put("sdp_offer", sdpOffer)
        val payload =
            executePost(
                path = "/call-sessions",
                accessToken = accessToken,
                body = body,
                expectedStatusCode = 201,
            )
        CreatedAiCallSession(
            callSessionId = payload.requiredLong("call_session_id"),
            sdpAnswer = payload.requiredString("sdp_answer"),
        )
      }

  override suspend fun reportConnectionResult(
      accessToken: String,
      callSessionId: Long,
      result: AiCallConnectionResult,
      errorCode: String?,
  ): Long =
      withContext(Dispatchers.IO) {
        if (result == AiCallConnectionResult.Failed && errorCode.isNullOrBlank()) {
          throw AiCallApiException(
              statusCode = 400,
              errorCode = "INVALID_REQUEST",
              message = "A failure connection result requires an error code.",
          )
        }
        if (result == AiCallConnectionResult.Connected && !errorCode.isNullOrBlank()) {
          throw AiCallApiException(
              statusCode = 400,
              errorCode = "INVALID_REQUEST",
              message = "A connected result cannot include an error code.",
          )
        }
        val body = JSONObject().put("result", result.wireValue)
        if (result == AiCallConnectionResult.Failed) {
          body.put("error_code", errorCode)
        }
        executePost(
                path = "/call-sessions/$callSessionId/connection-result",
                accessToken = accessToken,
                body = body,
                expectedStatusCode = 200,
            )
            .requiredLong("call_session_id")
      }

  override suspend fun endCallSession(
      accessToken: String,
      callSessionId: Long,
      terminationType: AiCallTerminationType,
  ): Long =
      withContext(Dispatchers.IO) {
        executePost(
                path = "/call-sessions/$callSessionId/end",
                accessToken = accessToken,
                body = JSONObject().put("termination_type", terminationType.wireValue),
                expectedStatusCode = 202,
            )
            .requiredLong("call_session_id")
      }

  private fun executePost(
      path: String,
      accessToken: String,
      body: JSONObject,
      expectedStatusCode: Int,
  ): JSONObject {
    if (baseUrl.isBlank()) {
      throw AiCallApiException(
          errorCode = "API_CONFIGURATION_ERROR",
          message = "The AI call API base URL is not configured.",
      )
    }

    val request =
        Request.Builder()
            .url("$baseUrl$path")
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .apply {
              if (accessToken.isNotBlank()) {
                header("Authorization", "Bearer $accessToken")
              }
            }
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

    return try {
      httpClient.newCall(request).execute().use { response ->
        val rawBody = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
          throw parseApiException(response.code, rawBody)
        }
        if (response.code != expectedStatusCode) {
          throw AiCallApiException(
              statusCode = response.code,
              errorCode = "INVALID_API_RESPONSE",
              message =
                  "The AI call server returned HTTP ${response.code}; expected $expectedStatusCode.",
          )
        }
        parseJsonObject(rawBody, response.code)
      }
    } catch (exception: AiCallApiException) {
      throw exception
    } catch (exception: IOException) {
      throw AiCallApiException(
          errorCode = "NETWORK_ERROR",
          message = "The AI call server could not be reached.",
          cause = exception,
      )
    }
  }

  private fun parseApiException(statusCode: Int, rawBody: String): AiCallApiException {
    val payload = runCatching { JSONObject(rawBody) }.getOrNull()
    val error = payload?.optJSONObject("error")
    val code = error?.optString("code").orEmpty().ifBlank { statusCode.toString() }
    val message =
        error?.optString("message").orEmpty().ifBlank {
          "The AI call request failed with HTTP $statusCode."
        }
    return AiCallApiException(statusCode, code, message)
  }

  private fun parseJsonObject(rawBody: String, statusCode: Int): JSONObject {
    if (rawBody.isBlank()) {
      throw AiCallApiException(
          statusCode = statusCode,
          errorCode = "INVALID_API_RESPONSE",
          message = "The AI call server returned an empty response.",
      )
    }
    return try {
      JSONObject(rawBody)
    } catch (exception: JSONException) {
      throw AiCallApiException(
          statusCode = statusCode,
          errorCode = "INVALID_API_RESPONSE",
          message = "The AI call server returned an invalid response.",
          cause = exception,
      )
    }
  }

  private fun JSONObject.requiredLong(name: String): Long {
    if (!has(name) || isNull(name)) {
      throw AiCallApiException(
          errorCode = "INVALID_API_RESPONSE",
          message = "The AI call response is missing $name.",
      )
    }
    return try {
      getLong(name)
    } catch (exception: JSONException) {
      throw AiCallApiException(
          errorCode = "INVALID_API_RESPONSE",
          message = "The AI call response contains an invalid $name.",
          cause = exception,
      )
    }
  }

  private fun JSONObject.requiredString(name: String): String {
    val value = optString(name)
    if (value.isBlank()) {
      throw AiCallApiException(
          errorCode = "INVALID_API_RESPONSE",
          message = "The AI call response is missing $name.",
      )
    }
    return value
  }

  companion object {
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    private val defaultHttpClient: OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
  }
}
