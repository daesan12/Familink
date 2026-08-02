package com.s15p11b104app.aicall

import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

internal interface AiCallAccessTokenProvider {
  fun currentAccessToken(): String?

  suspend fun refreshAccessToken(): String
}

internal class BridgeAiCallAccessTokenProvider(
    private val onRefreshRequested: (String) -> Unit,
    private val timeoutMillis: Long = DEFAULT_TIMEOUT_MILLIS,
) : AiCallAccessTokenProvider {

  private val lock = Any()
  private val nextRequestId = AtomicLong(0)
  private val pendingRequests = mutableMapOf<String, CompletableDeferred<String>>()
  private var latestSuccessfulRequestId = 0L

  @Volatile private var accessToken: String? = null

  override fun currentAccessToken(): String? = accessToken

  override suspend fun refreshAccessToken(): String {
    val requestId = nextRequestId.incrementAndGet().toString()
    val completion = CompletableDeferred<String>()
    synchronized(lock) { pendingRequests[requestId] = completion }

    return try {
      onRefreshRequested(requestId)
      withTimeout(timeoutMillis) { completion.await() }
    } catch (exception: TimeoutCancellationException) {
      throw AiCallApiException(
          errorCode = "AUTH_REFRESH_TIMEOUT",
          message = "Access Token refresh did not complete in time.",
          cause = exception,
      )
    } finally {
      synchronized(lock) {
        if (pendingRequests[requestId] === completion) {
          pendingRequests.remove(requestId)
        }
      }
    }
  }

  fun updateAccessToken(value: String?) {
    accessToken = value?.takeIf { it.isNotBlank() }
  }

  fun completeRefresh(
      requestId: String,
      refreshedAccessToken: String,
      errorCode: String,
  ) {
    val completion = synchronized(lock) { pendingRequests.remove(requestId) } ?: return
    if (errorCode.isBlank() && refreshedAccessToken.isNotBlank()) {
      val numericRequestId = requestId.toLongOrNull()
      synchronized(lock) {
        if (numericRequestId != null && numericRequestId >= latestSuccessfulRequestId) {
          latestSuccessfulRequestId = numericRequestId
          accessToken = refreshedAccessToken
        }
      }
      completion.complete(refreshedAccessToken)
      return
    }

    completion.completeExceptionally(
        AiCallApiException(
            errorCode = errorCode.ifBlank { "AUTH_REFRESH_FAILED" },
            message = "Access Token refresh failed.",
        )
    )
  }

  fun cancelPendingRequests() {
    val pending =
        synchronized(lock) {
          pendingRequests.values.toList().also { pendingRequests.clear() }
        }
    pending.forEach { completion ->
      completion.completeExceptionally(
          AiCallApiException(
              errorCode = "AUTH_REFRESH_CANCELLED",
              message = "Access Token refresh was cancelled.",
          )
      )
    }
  }

  companion object {
    private const val DEFAULT_TIMEOUT_MILLIS = 15_000L
  }
}
