package com.s15p11b104app.aicall

import android.content.Context
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.coroutines.cancellation.CancellationException

internal class AiCallRuntime(
    private val context: Context,
    private val sessionClient: AiCallSessionClient,
    private val onCaptionUpdate: (AiCallCaptionUpdate) -> Unit,
    private val onConnectionLost: () -> Unit,
) {

  private data class EndRequest(
      val accessToken: String?,
      val terminationType: AiCallTerminationType,
  )

  private data class EndDispatch(
      val request: EndRequest,
      val callSessionId: Long,
  )

  private val stateLock = Any()
  private val disposalScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val disposed = AtomicBoolean(false)
  private var startJob: Job? = null
  private var pendingEndRequest: EndRequest? = null
  private var endRequestSent = false
  private var endCompletion: CompletableDeferred<Unit>? = null
  private var webRtcSession: AiCallWebRtcSession? = null

  var callSessionId: Long? = null
    private set

  suspend fun start(
      bridgeContext: AiCallBridgeContext,
      personaId: Long,
  ) {
    if (disposed.get()) {
      throw AiCallApiException(
          errorCode = "CALL_RUNTIME_DISPOSED",
          message = "The AI call view is no longer available.",
      )
    }
    val accessToken =
        bridgeContext.accessToken?.takeIf { it.isNotBlank() }
            ?: throw AiCallApiException(
                statusCode = 401,
                errorCode = "UNAUTHORIZED",
                message = "An access token is required to start an AI call.",
            )
    val currentJob = currentCoroutineContext()[Job]
    synchronized(stateLock) {
      if (startJob != null) {
        throw AiCallApiException(
            statusCode = 409,
            errorCode = "ACTIVE_CALL_EXISTS",
            message = "An AI call is already being started.",
        )
      }
      startJob = currentJob
      callSessionId = null
      pendingEndRequest = null
      endRequestSent = false
      endCompletion = null
    }

    val session =
        try {
          AiCallWebRtcSession(
              context = context,
              onCaptionUpdate = onCaptionUpdate,
              onConnectionLost = onConnectionLost,
          )
        } catch (exception: Throwable) {
          synchronized(stateLock) {
            if (startJob === currentJob) {
              startJob = null
            }
          }
          completePendingEndWithoutServerSession()
          throw exception
        }
    webRtcSession = session

    var connectedReportStarted = false
    try {
      val sdpOffer = session.createOffer()
      // OkHttp's blocking execute can finish on the server after the coroutine is
      // cancelled. Keep the create request non-cancellable so the response ID is
      // always recorded and a pending user close can send /end for that session.
      val created =
          withContext(NonCancellable) {
            sessionClient.createCallSession(accessToken, personaId, sdpOffer)
          }
      synchronized(stateLock) { callSessionId = created.callSessionId }
      abortIfEnding(session)
      session.setRemoteAnswer(created.sdpAnswer)
      abortIfEnding(session)
      session.awaitConnected()
      abortIfEnding(session)
      connectedReportStarted = true
      sessionClient.reportConnectionResult(
          accessToken = accessToken,
          callSessionId = created.callSessionId,
          result = AiCallConnectionResult.Connected,
      )
    } catch (exception: CancellationException) {
      withContext(NonCancellable) {
        runCatching { dispatchPendingEndIfRequested() }
      }
      session.close()
      throw exception
    } catch (exception: Throwable) {
      if (hasPendingEndRequest()) {
        withContext(NonCancellable) {
          runCatching { dispatchPendingEndIfRequested() }
        }
      } else {
        currentCallSessionId()?.let { createdSessionId ->
          if (connectedReportStarted) {
            // CONNECTED may already have been committed when its response was
            // lost. FAILED is invalid for an IN_PROGRESS session, so compensate
            // with the idempotent end endpoint instead.
            withContext(NonCancellable) {
              runCatching {
                sessionClient.endCallSession(
                    accessToken = accessToken,
                    callSessionId = createdSessionId,
                    terminationType = AiCallTerminationType.ConnectionLost,
                )
              }
            }
          } else {
            runCatching {
              sessionClient.reportConnectionResult(
                  accessToken = accessToken,
                  callSessionId = createdSessionId,
                  result = AiCallConnectionResult.Failed,
                  errorCode = "WEBRTC_CONNECTION_FAILED",
              )
            }
          }
        }
      }
      session.close()
      throw exception
    } finally {
      synchronized(stateLock) {
        if (startJob === currentJob) {
          startJob = null
        }
      }
      completePendingEndWithoutServerSession()
      if (webRtcSession === session) {
        webRtcSession = null
      }
    }
  }

  suspend fun end(
      accessToken: String?,
      terminationType: AiCallTerminationType,
  ) {
    val request = EndRequest(accessToken?.takeIf { it.isNotBlank() }, terminationType)
    val completion: CompletableDeferred<Unit>
    val activeStartJob: Job?
    val existingSessionId: Long?
    synchronized(stateLock) {
      pendingEndRequest = request
      completion = endCompletion ?: CompletableDeferred<Unit>().also { endCompletion = it }
      activeStartJob = startJob
      existingSessionId = callSessionId
    }

    activeStartJob?.cancel()
    close()

    if (existingSessionId != null) {
      dispatchPendingEndIfRequested()
    } else if (activeStartJob == null) {
      completePendingEndWithoutServerSession()
    }

    if (activeStartJob != null && !completion.isCompleted) {
      // The create request is intentionally non-cancellable so a server-side
      // session ID cannot be lost between cancellation and the HTTP response.
      // Wait for that response before reporting local completion; otherwise a
      // slow request could leave the start job alive after the UI retries.
      withContext(NonCancellable) { completion.await() }
    }
  }

  fun dispose(accessToken: String?) {
    if (!disposed.compareAndSet(false, true)) {
      close()
      return
    }
    disposalScope.launch {
      try {
        end(accessToken, AiCallTerminationType.UserRequested)
      } catch (_: Throwable) {
        close()
      } finally {
        disposalScope.cancel()
      }
    }
  }

  fun setMicrophoneEnabled(enabled: Boolean) {
    webRtcSession?.setMicrophoneEnabled(enabled)
  }

  fun setSpeakerEnabled(enabled: Boolean) {
    webRtcSession?.setSpeakerEnabled(enabled)
  }

  fun close() {
    webRtcSession?.close()
    webRtcSession = null
  }

  private suspend fun abortIfEnding(session: AiCallWebRtcSession) {
    if (!hasPendingEndRequest()) {
      return
    }
    dispatchPendingEndIfRequested()
    session.close()
    throw CancellationException("The AI call was ended before it connected.")
  }

  private suspend fun dispatchPendingEndIfRequested() {
    val dispatch =
        synchronized(stateLock) {
          if (endRequestSent) {
            null
          } else {
            val request = pendingEndRequest
            val sessionId = callSessionId
            if (request == null || sessionId == null) {
              null
            } else {
              endRequestSent = true
              EndDispatch(request, sessionId)
            }
          }
        } ?: return

    val completion = synchronized(stateLock) { endCompletion }
    try {
      val token =
          dispatch.request.accessToken
              ?: throw AiCallApiException(
                  statusCode = 401,
                  errorCode = "UNAUTHORIZED",
                  message = "An access token is required to end an AI call.",
              )
      sessionClient.endCallSession(
          accessToken = token,
          callSessionId = dispatch.callSessionId,
          terminationType = dispatch.request.terminationType,
      )
      synchronized(stateLock) { completion?.complete(Unit) }
    } catch (exception: Throwable) {
      synchronized(stateLock) {
        completion?.completeExceptionally(exception)
        if (endCompletion === completion) {
          endRequestSent = false
          endCompletion = null
        }
      }
      throw exception
    }
  }

  private fun hasPendingEndRequest(): Boolean = synchronized(stateLock) {
    pendingEndRequest != null
  }

  private fun currentCallSessionId(): Long? = synchronized(stateLock) { callSessionId }

  private fun completePendingEndWithoutServerSession() {
    synchronized(stateLock) {
      if (pendingEndRequest != null && !endRequestSent && callSessionId == null) {
        endRequestSent = true
        endCompletion?.complete(Unit)
      }
    }
  }

  companion object {
  }
}
