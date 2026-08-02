package com.s15p11b104app.aicall

import android.content.ContextWrapper
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class AiCallRuntimeTest {

  @Test
  fun `connected media session remains controllable until end`() = runBlocking {
    val mediaSession = RecordingMediaSession()
    val client =
        RecordingSessionClient(
            endResults = ArrayDeque(listOf(Result.success(42L))),
        )
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = client,
            accessTokenProvider = RecordingAccessTokenProvider(),
            onCaptionUpdate = {},
            onConnectionLost = {},
            mediaSessionFactory = { _, _, _ -> mediaSession },
        )

    runtime.start(personaId = 4L)
    runtime.setMicrophoneEnabled(false)
    runtime.setSpeakerEnabled(false)

    assertEquals(listOf(false), mediaSession.microphoneStates)
    assertEquals(listOf(false), mediaSession.speakerStates)
    assertEquals(0, mediaSession.closeCount)

    runtime.end(AiCallTerminationType.UserRequested)

    assertEquals(1, mediaSession.closeCount)
    assertEquals(1, client.endCallCount)
  }

  @Test
  fun `failed start closes owned media session and clears controls`() = runBlocking {
    val mediaSession = RecordingMediaSession(connectionFailure = IllegalStateException("failed"))
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = RecordingSessionClient(endResults = ArrayDeque()),
            accessTokenProvider = RecordingAccessTokenProvider(),
            onCaptionUpdate = {},
            onConnectionLost = {},
            mediaSessionFactory = { _, _, _ -> mediaSession },
        )

    val exception =
        assertThrows(IllegalStateException::class.java) {
          runBlocking { runtime.start(personaId = 4L) }
        }

    assertEquals("failed", exception.message)
    assertEquals(1, mediaSession.closeCount)
    runtime.setMicrophoneEnabled(false)
    runtime.setSpeakerEnabled(false)
    runtime.close()
    assertFalse(mediaSession.microphoneStates.isNotEmpty())
    assertFalse(mediaSession.speakerStates.isNotEmpty())
    assertEquals(1, mediaSession.closeCount)
  }

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
    ): CreatedAiCallSession =
        CreatedAiCallSession(
            callSessionId = 42L,
            sdpAnswer = "answer",
        )

    override suspend fun reportConnectionResult(
        accessToken: String,
        callSessionId: Long,
        result: AiCallConnectionResult,
        errorCode: String?,
    ): Long = callSessionId

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

  private class RecordingMediaSession(
      private val connectionFailure: Throwable? = null,
  ) : AiCallMediaSession {

    val microphoneStates = mutableListOf<Boolean>()
    val speakerStates = mutableListOf<Boolean>()
    var closeCount = 0
      private set

    override suspend fun createOffer(): String = "offer"

    override suspend fun setRemoteAnswer(sdpAnswer: String) = Unit

    override suspend fun awaitConnected(timeoutMillis: Long) {
      connectionFailure?.let { throw it }
    }

    override fun setMicrophoneEnabled(enabled: Boolean) {
      microphoneStates += enabled
    }

    override fun setSpeakerEnabled(enabled: Boolean) {
      speakerStates += enabled
    }

    override fun close() {
      closeCount += 1
    }
  }
}
