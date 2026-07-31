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
    val api = HttpAiCallSessionClient("https://api.example.com", client)

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
    val api = HttpAiCallSessionClient("https://api.example.com", client)

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
    val api = HttpAiCallSessionClient("https://api.example.com", client)

    val exception =
        assertThrows(AiCallApiException::class.java) {
          runBlocking { api.createCallSession("token-123", 1, "v=0") }
        }
    assertEquals(409, exception.statusCode)
    assertEquals("ACTIVE_CALL_EXISTS", exception.errorCode)
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
}
