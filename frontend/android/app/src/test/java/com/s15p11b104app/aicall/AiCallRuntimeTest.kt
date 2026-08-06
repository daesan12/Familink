package com.s15p11b104app.aicall

import android.content.ContextWrapper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AiCallRuntimeTest {

  @Test
  fun `connected media session remains controllable until end`() = runBlocking {
    val endEvents = mutableListOf<String>()
    val mediaSession = RecordingMediaSession(endEvents = endEvents)
    val client =
        RecordingSessionClient(
            endResults = ArrayDeque(listOf(Result.success(42L))),
            endEvents = endEvents,
        )
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = client,
            accessTokenProvider = RecordingAccessTokenProvider(),
            onCaptionUpdate = {},
            onConnectionLost = {},
            mediaSessionFactory = { _, _, _ -> mediaSession },
            mediaContext = Dispatchers.Unconfined,
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
    assertEquals(listOf("server-end", "local-close"), endEvents)
  }

  @Test
  fun `microphone toggles reach the media session as plain user intent`() = runBlocking {
    // Runtime은 사용자 조작을 해석하지 않고 1:1로 전달만 한다. AI 발화 게이팅은
    // AiCallWebRtcSession 내부에서 처리하므로, 나중에 게이팅 판단을 Runtime으로 옮기면
    // 이 단정이 깨진다. 게이팅 자체의 합성 동작은 AiCallMicrophoneGateControllerTest가 본다.
    val mediaSession = RecordingMediaSession()
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = RecordingSessionClient(endResults = ArrayDeque(emptyList())),
            accessTokenProvider = RecordingAccessTokenProvider(),
            onCaptionUpdate = {},
            onConnectionLost = {},
            mediaSessionFactory = { _, _, _ -> mediaSession },
            mediaContext = Dispatchers.Unconfined,
        )

    runtime.start(personaId = 4L)
    runtime.setMicrophoneEnabled(false)
    runtime.setMicrophoneEnabled(true)
    runtime.setMicrophoneEnabled(false)

    assertEquals(listOf(false, true, false), mediaSession.microphoneStates)
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
            mediaContext = Dispatchers.Unconfined,
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
    val endEvents = mutableListOf<String>()
    val mediaSession = RecordingMediaSession(endEvents = endEvents)
    val client =
        RecordingSessionClient(
            endResults =
                ArrayDeque(
                    listOf(
                        Result.failure(IllegalStateException("temporary failure")),
                        Result.success(42L),
                    )
                ),
            endEvents = endEvents,
        )
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = client,
            accessTokenProvider = RecordingAccessTokenProvider(),
            onCaptionUpdate = {},
            onConnectionLost = {},
            mediaSessionFactory = { _, _, _ -> mediaSession },
            mediaContext = Dispatchers.Unconfined,
        )
    setCallSessionId(runtime, 42L)
    setWebRtcSession(runtime, mediaSession)

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
    assertEquals(1, mediaSession.closeCount)
    assertEquals(listOf("server-end", "local-close", "server-end"), endEvents)
  }

  @Test
  fun `end reuses the current token without asking the bridge to refresh`() = runBlocking {
    val client =
        RecordingSessionClient(
            endResults = ArrayDeque(listOf(Result.success(42L))),
        )
    val accessTokenProvider = RecordingAccessTokenProvider(heldAccessToken = "held-token")
    val runtime =
        AiCallRuntime(
            context = ContextWrapper(null),
            sessionClient = client,
            accessTokenProvider = accessTokenProvider,
            onCaptionUpdate = {},
            onConnectionLost = {},
        )
    setCallSessionId(runtime, 42L)

    runtime.end(AiCallTerminationType.UserRequested)

    assertEquals(listOf("held-token"), client.endTokens)
    assertEquals(0, accessTokenProvider.refreshCount)
  }

  @Test
  fun `end returns without waiting for the media session teardown`() = runBlocking {
    val closeStarted = CountDownLatch(1)
    val closeReleased = CountDownLatch(1)
    val mediaSession = BlockingCloseMediaSession(closeStarted, closeReleased)
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

    try {
      runtime.start(personaId = 4L)
      runtime.end(AiCallTerminationType.UserRequested)

      assertEquals(1, client.endCallCount)
      assertTrue(closeStarted.await(2, TimeUnit.SECONDS))
      assertFalse(mediaSession.closeFinished)
    } finally {
      closeReleased.countDown()
    }
  }

  @Test
  fun `end completes when start is cancelled while awaiting the previous teardown`() =
      runBlocking {
        val closeStarted = CountDownLatch(1)
        val closeReleased = CountDownLatch(1)
        val blockingSession = BlockingCloseMediaSession(closeStarted, closeReleased)
        val client =
            RecordingSessionClient(
                endResults = ArrayDeque(listOf(Result.success(42L), Result.success(43L))),
            )
        val runtime =
            AiCallRuntime(
                context = ContextWrapper(null),
                sessionClient = client,
                accessTokenProvider = RecordingAccessTokenProvider(),
                onCaptionUpdate = {},
                onConnectionLost = {},
                mediaSessionFactory = { _, _, _ -> blockingSession },
            )

        try {
          // 첫 통화를 종료해 정리 작업을 진행 중으로 만든다.
          runtime.start(personaId = 4L)
          runtime.end(AiCallTerminationType.UserRequested)
          assertTrue(closeStarted.await(2, TimeUnit.SECONDS))

          // 두 번째 start는 이전 정리를 기다리며 멈춘다. 그 상태에서 취소한 뒤 종료를 요청해도
          // 응답이 돌아와야 한다.
          val secondStart = launch { runCatching { runtime.start(personaId = 5L) } }
          secondStart.cancel()
          withTimeout(3_000) { runtime.end(AiCallTerminationType.UserRequested) }
        } finally {
          closeReleased.countDown()
        }
      }

  @Test
  fun `dispose ends the call with the current token when the bridge is detached`() = runBlocking {
    val endEvents = mutableListOf<String>()
    val endCompleted = CompletableDeferred<Unit>()
    val client =
        RecordingSessionClient(
            endResults = ArrayDeque(listOf(Result.success(42L))),
            endEvents = endEvents,
            onEnd = { endCompleted.complete(Unit) },
        )
    val mediaSession = RecordingMediaSession(endEvents = endEvents)
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
            mediaContext = Dispatchers.Unconfined,
        )
    setCallSessionId(runtime, 42L)
    setWebRtcSession(runtime, mediaSession)

    runtime.dispose()
    withTimeout(1_000) { endCompleted.await() }

    assertEquals(1, client.endCallCount)
    assertEquals(listOf("current-access-token"), client.endTokens)
    assertEquals(1, mediaSession.closeCount)
    assertEquals(listOf("server-end", "local-close"), endEvents)
  }

  private fun setCallSessionId(runtime: AiCallRuntime, callSessionId: Long) {
    AiCallRuntime::class.java.getDeclaredField("callSessionId").apply {
      isAccessible = true
      set(runtime, callSessionId)
    }
  }

  private fun setWebRtcSession(runtime: AiCallRuntime, mediaSession: AiCallMediaSession) {
    AiCallRuntime::class.java.getDeclaredField("webRtcSession").apply {
      isAccessible = true
      set(runtime, mediaSession)
    }
  }

  private class RecordingSessionClient(
      private val endResults: ArrayDeque<Result<Long>>,
      private val endEvents: MutableList<String>? = null,
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
      endEvents?.add("server-end")
      return endResults.removeFirst().getOrThrow().also { onEnd() }
    }
  }

  private class RecordingAccessTokenProvider(
      private val heldAccessToken: String? = null,
  ) : AiCallAccessTokenProvider {

    var refreshCount = 0
      private set

    override fun currentAccessToken(): String? = heldAccessToken

    override suspend fun refreshAccessToken(): String {
      refreshCount += 1
      return "access-token-$refreshCount"
    }
  }

  private class BlockingCloseMediaSession(
      private val closeStarted: CountDownLatch,
      private val closeReleased: CountDownLatch,
  ) : AiCallMediaSession {

    private val finished = AtomicBoolean(false)

    val closeFinished: Boolean
      get() = finished.get()

    override suspend fun createOffer(): String = "offer"

    override suspend fun setRemoteAnswer(sdpAnswer: String) = Unit

    override suspend fun awaitConnected(timeoutMillis: Long) = Unit

    override fun setMicrophoneEnabled(enabled: Boolean) = Unit

    override fun setSpeakerEnabled(enabled: Boolean) = Unit

    override fun close() {
      closeStarted.countDown()
      closeReleased.await()
      finished.set(true)
    }
  }

  private class RecordingMediaSession(
      private val connectionFailure: Throwable? = null,
      private val endEvents: MutableList<String>? = null,
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
      endEvents?.add("local-close")
    }
  }
}
