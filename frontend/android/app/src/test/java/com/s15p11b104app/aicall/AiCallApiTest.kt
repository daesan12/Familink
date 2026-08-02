package com.s15p11b104app.aicall

import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AiCallApiTest {

  @Test
  fun `create sends bearer token and the exact call contract`() = runBlocking {
    val requestRef = AtomicReference<okhttp3.Request>()
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              requestRef.set(chain.request())
              response(
                  chain,
                  "{\"call_session_id\":42,\"sdp_answer\":\"v=0\\r\\n\"}",
                  code = 201,
              )
            }
            .build()
    val api =
        HttpAiCallSessionClient(
            "https://api.example.com",
            RecordingAccessTokenProvider("token-123"),
            client,
        )

    val created = api.createCallSession("token-123", 4, "v=0\r\n")

    assertEquals(42L, created.callSessionId)
    assertEquals("v=0\r\n", created.sdpAnswer)
    val request = requestRef.get()
    assertEquals("Bearer token-123", request.header("Authorization"))
    assertEquals("https://api.example.com/call-sessions", request.url.toString())
    assertEquals(
        "{\"persona_id\":4,\"sdp_offer\":\"v=0\\r\\n\"}",
        requestBody(request),
    )
  }

  @Test
  fun `connection failure requires error code and sends no group context`() = runBlocking {
    val requestRef = AtomicReference<okhttp3.Request>()
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              requestRef.set(chain.request())
              response(chain, "{\"call_session_id\":42}")
            }
            .build()
    val api =
        HttpAiCallSessionClient(
            "https://api.example.com",
            RecordingAccessTokenProvider("token-123"),
            client,
        )

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking {
            api.reportConnectionResult(
                accessToken = "token-123",
                callSessionId = 42,
                result = AiCallConnectionResult.Failed,
            )
          }
        }
    assertEquals("INVALID_REQUEST", exception.errorCode)
    assertEquals(null, requestRef.get())
  }

  @Test
  fun `server errors preserve the contract error code`() = runBlocking {
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              Response.Builder()
                  .request(chain.request())
                  .protocol(Protocol.HTTP_1_1)
                  .code(409)
                  .message("Conflict")
                  .body(
                      "{\"error\":{\"code\":\"ACTIVE_CALL_EXISTS\",\"message\":\"active\"}}"
                          .toResponseBody(),
                  )
                  .build()
            }
            .build()
    val api =
        HttpAiCallSessionClient(
            "https://api.example.com",
            RecordingAccessTokenProvider("token-123"),
            client,
        )

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { api.createCallSession("token-123", 1, "v=0") }
        }
    assertEquals(409, exception.statusCode)
    assertEquals("ACTIVE_CALL_EXISTS", exception.errorCode)
  }

  @Test
  fun `unauthorized response refreshes once and retries with the new token`() = runBlocking {
    val seenTokens = mutableListOf<String?>()
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              val token = chain.request().header("Authorization")
              seenTokens += token
              if (token == "Bearer new-access") {
                response(chain, "{\"call_session_id\":42}")
              } else {
                response(
                    chain,
                    "{\"code\":\"UNAUTHORIZED\",\"message\":\"expired\"}",
                    code = 401,
                )
              }
            }
            .build()
    val tokenProvider = RecordingAccessTokenProvider("old-access", "new-access")
    val api = HttpAiCallSessionClient("https://api.example.com", tokenProvider, client)

    val callSessionId =
        api.reportConnectionResult(
            accessToken = "old-access",
            callSessionId = 42,
            result = AiCallConnectionResult.Connected,
        )

    assertEquals(42L, callSessionId)
    assertEquals(listOf("Bearer old-access", "Bearer new-access"), seenTokens)
    assertEquals(1, tokenProvider.refreshCount)
  }

  @Test
  fun `a second unauthorized response is not retried again`() = runBlocking {
    var requestCount = 0
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              requestCount += 1
              response(
                  chain,
                  "{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"expired\"}}",
                  code = 401,
              )
            }
            .build()
    val tokenProvider = RecordingAccessTokenProvider("old-access", "new-access")
    val api = HttpAiCallSessionClient("https://api.example.com", tokenProvider, client)

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { api.createCallSession("old-access", 1, "v=0") }
        }

    assertEquals("UNAUTHORIZED", exception.errorCode)
    assertEquals(2, requestCount)
    assertEquals(1, tokenProvider.refreshCount)
  }

  @Test
  fun `forbidden response does not refresh or retry`() = runBlocking {
    var requestCount = 0
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              requestCount += 1
              response(
                  chain,
                  "{\"error\":{\"code\":\"FORBIDDEN\",\"message\":\"forbidden\"}}",
                  code = 403,
              )
            }
            .build()
    val tokenProvider = RecordingAccessTokenProvider("old-access", "new-access")
    val api = HttpAiCallSessionClient("https://api.example.com", tokenProvider, client)

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { api.createCallSession("old-access", 1, "v=0") }
        }

    assertEquals("FORBIDDEN", exception.errorCode)
    assertEquals(1, requestCount)
    assertEquals(0, tokenProvider.refreshCount)
  }

  @Test
  fun `late unauthorized response reuses an already refreshed token`() = runBlocking {
    val seenTokens = mutableListOf<String?>()
    val client =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
              val token = chain.request().header("Authorization")
              seenTokens += token
              if (token == "Bearer new-access") {
                response(chain, "{\"call_session_id\":42}")
              } else {
                response(
                    chain,
                    "{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"expired\"}}",
                    code = 401,
                )
              }
            }
            .build()
    val tokenProvider = RecordingAccessTokenProvider("new-access", "unused-access")
    val api = HttpAiCallSessionClient("https://api.example.com", tokenProvider, client)

    val callSessionId =
        api.reportConnectionResult(
            accessToken = "old-access",
            callSessionId = 42,
            result = AiCallConnectionResult.Connected,
        )

    assertEquals(42L, callSessionId)
    assertEquals(listOf("Bearer old-access", "Bearer new-access"), seenTokens)
    assertEquals(0, tokenProvider.refreshCount)
  }

  private fun response(
      chain: okhttp3.Interceptor.Chain,
      body: String,
      code: Int = 200,
  ): Response =
      Response.Builder()
          .request(chain.request())
          .protocol(Protocol.HTTP_1_1)
          .code(code)
          .message("OK")
          .body(body.toResponseBody())
          .build()

  private fun requestBody(request: okhttp3.Request): String {
    val buffer = Buffer()
    request.body?.writeTo(buffer)
    return buffer.readUtf8()
  }

  private class RecordingAccessTokenProvider(
      initialAccessToken: String?,
      private val refreshedAccessToken: String = initialAccessToken.orEmpty(),
  ) : AiCallAccessTokenProvider {

    private var accessToken = initialAccessToken
    var refreshCount = 0
      private set

    override fun currentAccessToken(): String? = accessToken

    override suspend fun refreshAccessToken(): String {
      refreshCount += 1
      accessToken = refreshedAccessToken
      return refreshedAccessToken
    }
  }
}
