package com.s15p11b104app.aicall

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
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
            onCaptionUpdate = {},
            onConnectionLost = {},
        )
    setCallSessionId(runtime, 42L)

    val exception =
        assertThrows(IllegalStateException::class.java) {
          runBlocking {
            runtime.end("access-token", AiCallTerminationType.UserRequested)
          }
        }

    assertEquals("temporary failure", exception.message)
    runtime.end("access-token", AiCallTerminationType.UserRequested)
    assertEquals(2, client.endCallCount)
  }

  private fun setCallSessionId(runtime: AiCallRuntime, callSessionId: Long) {
    AiCallRuntime::class.java.getDeclaredField("callSessionId").apply {
      isAccessible = true
      set(runtime, callSessionId)
    }
  }

  private class RecordingSessionClient(
      private val endResults: ArrayDeque<Result<Long>>,
  ) : AiCallSessionClient {

    var endCallCount = 0
      private set

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
      return endResults.removeFirst().getOrThrow()
    }
  }
}
