package com.s15p11b104app.aicall

import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class AiCallAccessTokenProviderTest {

  @Test
  fun `matching bridge response completes refresh and updates current token`() = runBlocking {
    lateinit var provider: BridgeAiCallAccessTokenProvider
    provider =
        BridgeAiCallAccessTokenProvider(
            onRefreshRequested = { requestId ->
              provider.completeRefresh(requestId, "new-access", "")
            }
        )

    assertEquals("new-access", provider.refreshAccessToken())
    assertEquals("new-access", provider.currentAccessToken())
  }

  @Test
  fun `bridge failure preserves the stable error code`() {
    lateinit var provider: BridgeAiCallAccessTokenProvider
    provider =
        BridgeAiCallAccessTokenProvider(
            onRefreshRequested = { requestId ->
              provider.completeRefresh(requestId, "", "AUTH_SESSION_UNAVAILABLE")
            }
        )

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { provider.refreshAccessToken() }
        }

    assertEquals("AUTH_SESSION_UNAVAILABLE", exception.errorCode)
    assertNull(provider.currentAccessToken())
  }

  @Test
  fun `missing bridge response times out`() {
    val provider =
        BridgeAiCallAccessTokenProvider(
            onRefreshRequested = {},
            timeoutMillis = 25,
        )

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { provider.refreshAccessToken() }
        }

    assertEquals("AUTH_REFRESH_TIMEOUT", exception.errorCode)
  }

  @Test
  fun `view disposal cancels a pending refresh and ignores its late response`() {
    lateinit var provider: BridgeAiCallAccessTokenProvider
    var capturedRequestId = ""
    provider =
        BridgeAiCallAccessTokenProvider(
            onRefreshRequested = { requestId ->
              capturedRequestId = requestId
              provider.cancelPendingRequests()
            }
        )

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { provider.refreshAccessToken() }
        }
    provider.completeRefresh(capturedRequestId, "late-access", "")

    assertEquals("AUTH_REFRESH_CANCELLED", exception.errorCode)
    assertNull(provider.currentAccessToken())
  }

  @Test
  fun `concurrent refresh responses are matched by request ID`() = runBlocking {
    val requestIds = mutableListOf<String>()
    val provider =
        BridgeAiCallAccessTokenProvider(
            onRefreshRequested = { requestId -> requestIds += requestId }
        )

    val first = async(start = CoroutineStart.UNDISPATCHED) { provider.refreshAccessToken() }
    val second = async(start = CoroutineStart.UNDISPATCHED) { provider.refreshAccessToken() }

    provider.completeRefresh(requestIds[1], "second-access", "")
    provider.completeRefresh(requestIds[0], "first-access", "")

    assertEquals("first-access", first.await())
    assertEquals("second-access", second.await())
    assertEquals("second-access", provider.currentAccessToken())
  }
}
