package com.s15p11b104app.aicall

import android.content.ContextWrapper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AiCallRuntimeTest {

  @Test
  fun `failed end request can be retried with a new HTTP request`() = runBlocking {
    val client =
        RecordingSessionClient(
            endResults =
                ArrayDeque(
                    listOf(
                        Result.failure(IllegalStateException("temporary failure")),
                        Result.success(42L),
                    )
                )
        )
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = client,
            accessTokenProvider = RecordingAccessTokenProvider(),
            onCaptionUpdate = {},
            onConnectionLost = {},
        )
    setCallSessionId(runtime, 42L)

    val exception =
        assertThrows(IllegalStateException::class.java) {
          runBlocking {
            runtime.end(AiCallTerminationType.UserRequested)
          }
        }

    assertEquals("temporary failure", exception.message)
    runtime.end(AiCallTerminationType.UserRequested)
    assertEquals(2, client.endCallCount)
    assertEquals(listOf("access-token-1", "access-token-2"), client.endTokens)
  }

  @Test
  fun `dispose falls back to the current token when the bridge is detached`() = runBlocking {
    val endCompleted = CompletableDeferred<Unit>()
    val client =
        RecordingSessionClient(
            endResults = ArrayDeque(listOf(Result.success(42L))),
            onEnd = { endCompleted.complete(Unit) },
        )
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = client,
            accessTokenProvider =
                object : AiCallAccessTokenProvider {
                  override fun currentAccessToken(): String = "current-access-token"

                  override suspend fun refreshAccessToken(): String {
                    throw AiCallApiException(
                        errorCode = "AUTH_REFRESH_CANCELLED",
                        message = "The bridge was detached.",
                    )
                  }
                },
            onCaptionUpdate = {},
            onConnectionLost = {},
        )
    setCallSessionId(runtime, 42L)

    runtime.dispose()
    withTimeout(1_000) { endCompleted.await() }

    assertEquals(1, client.endCallCount)
    assertEquals(listOf("current-access-token"), client.endTokens)
  }

  private fun setCallSessionId(runtime: AiCallRuntime, callSessionId: Long) {
    AiCallRuntime::class.java.getDeclaredField("callSessionId").apply {
      isAccessible = true
      set(runtime, callSessionId)
    }
  }

  private class RecordingSessionClient(
      private val endResults: ArrayDeque<Result<Long>>,
      private val onEnd: () -> Unit = {},
  ) : AiCallSessionClient {

    var endCallCount = 0
      private set
    val endTokens = mutableListOf<String>()

    override suspend fun createCallSession(
        accessToken: String,
        personaId: Long,
        sdpOffer: String,
    ): CreatedAiCallSession = error("unused")

    override suspend fun reportConnectionResult(
        accessToken: String,
        callSessionId: Long,
        result: AiCallConnectionResult,
        errorCode: String?,
    ): Long = error("unused")

    override suspend fun endCallSession(
        accessToken: String,
        callSessionId: Long,
        terminationType: AiCallTerminationType,
    ): Long {
      endCallCount += 1
      endTokens += accessToken
      return endResults.removeFirst().getOrThrow().also { onEnd() }
    }
  }

  private class RecordingAccessTokenProvider : AiCallAccessTokenProvider {
    private var refreshCount = 0

    override fun currentAccessToken(): String? = null

    override suspend fun refreshAccessToken(): String {
      refreshCount += 1
      return "access-token-$refreshCount"
    }
  }
}
