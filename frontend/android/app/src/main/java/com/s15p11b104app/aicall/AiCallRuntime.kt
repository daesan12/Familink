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
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.cancellation.CancellationException

internal class AiCallRuntime(
    private val context: Context,
    private val sessionClient: AiCallSessionClient,
    private val accessTokenProvider: AiCallAccessTokenProvider,
    private val onCaptionUpdate: (AiCallCaptionUpdate) -> Unit,
    private val onConnectionLost: () -> Unit,
    private val mediaSessionFactory:
        (Context, (AiCallCaptionUpdate) -> Unit, () -> Unit) -> AiCallMediaSession =
        { sessionContext, captionCallback, connectionLostCallback ->
          AiCallWebRtcSession(
              context = sessionContext,
              onCaptionUpdate = captionCallback,
              onConnectionLost = connectionLostCallback,
          )
        },
    private val mediaContext: CoroutineContext = Dispatchers.IO,
) {

  private data class EndDispatch(
      val terminationType: AiCallTerminationType,
      val callSessionId: Long,
  )

  private val stateLock = Any()
  private val disposalScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  // Never cancelled, unlike disposalScope: dispose() cancels that scope when it
  // returns, which would abort a teardown launched moments earlier and leak the
  // microphone and the WebRTC factory for the rest of the process.
  private val mediaScope = CoroutineScope(SupervisorJob() + mediaContext)
  private val disposed = AtomicBoolean(false)
  private var startJob: Job? = null
  private var pendingEndTermination: AiCallTerminationType? = null
  private var endRequestSent = false
  private var endCompletion: CompletableDeferred<Unit>? = null
  private var webRtcSession: AiCallMediaSession? = null
  private var pendingMediaClose: Job? = null

  var callSessionId: Long? = null
    private set

  suspend fun start(personaId: Long) {
    if (disposed.get()) {
      throw AiCallApiException(
          errorCode = "CALL_RUNTIME_DISPOSED",
          message = "The AI call view is no longer available.",
      )
    }
    val currentJob = currentCoroutineContext()[Job]
    synchronized(stateLock) {
      if (startJob != null || webRtcSession != null) {
        throw AiCallApiException(
            statusCode = 409,
            errorCode = "ACTIVE_CALL_EXISTS",
            message = "An AI call is already being started.",
        )
      }
      startJob = currentJob
      callSessionId = null
      pendingEndTermination = null
      endRequestSent = false
      endCompletion = null
    }

    val accessToken =
        try {
          accessTokenProvider.refreshAccessToken()
        } catch (exception: Throwable) {
          synchronized(stateLock) {
            if (startJob === currentJob) {
              startJob = null
            }
          }
          completePendingEndWithoutServerSession()
          throw exception
        }

    // Audio routing and the audio device module are process-wide, so a previous
    // session must finish releasing them before the next one claims them. Otherwise
    // the old teardown restores the audio mode the new call just set, or the new
    // audio device module fails to acquire the microphone.
    //
    // This is a suspension point, so cancelling the start job resumes here with a
    // CancellationException. It must release startJob and complete a pending end the
    // same way the other pre-session failures do; otherwise end() waits forever on an
    // endCompletion nobody can finish.
    try {
      awaitPendingMediaClose()
    } catch (exception: Throwable) {
      synchronized(stateLock) {
        if (startJob === currentJob) {
          startJob = null
        }
      }
      completePendingEndWithoutServerSession()
      throw exception
    }

    val session =
        try {
          withContext(mediaContext) {
            mediaSessionFactory(context, onCaptionUpdate, onConnectionLost)
          }
        } catch (exception: Throwable) {
          synchronized(stateLock) {
            if (startJob === currentJob) {
              startJob = null
            }
          }
          completePendingEndWithoutServerSession()
          throw exception
        }
    val ownsSession =
        synchronized(stateLock) {
          if (startJob === currentJob && pendingEndTermination == null && webRtcSession == null) {
            webRtcSession = session
            true
          } else {
            false
          }
        }
    if (!ownsSession) {
      closeInBackground(session)
      throw CancellationException("The AI call was ended while media was initializing.")
    }

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
      closeSession(session)
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
      closeSession(session)
      throw exception
    } finally {
      synchronized(stateLock) {
        if (startJob === currentJob) {
          startJob = null
        }
      }
      completePendingEndWithoutServerSession()
    }
  }

  suspend fun end(terminationType: AiCallTerminationType) {
    requestEnd(terminationType)
  }

  private suspend fun requestEnd(terminationType: AiCallTerminationType) {
    val completion: CompletableDeferred<Unit>
    val activeStartJob: Job?
    val existingSessionId: Long?
    synchronized(stateLock) {
      pendingEndTermination = terminationType
      completion = endCompletion ?: CompletableDeferred<Unit>().also { endCompletion = it }
      activeStartJob = startJob
      existingSessionId = callSessionId
    }

    activeStartJob?.cancel()
    if (existingSessionId != null) {
      try {
        dispatchPendingEndIfRequested()
      } finally {
        close()
      }
    } else {
      close()
      if (activeStartJob == null) {
        completePendingEndWithoutServerSession()
      }
    }

    if (activeStartJob != null && !completion.isCompleted) {
      // The create request is intentionally non-cancellable so a server-side
      // session ID cannot be lost between cancellation and the HTTP response.
      // Wait for that response before reporting local completion; otherwise a
      // slow request could leave the start job alive after the UI retries.
      withContext(NonCancellable) { completion.await() }
    }
  }

  fun dispose() {
    if (!disposed.compareAndSet(false, true)) {
      close()
      return
    }
    disposalScope.launch {
      try {
        requestEnd(AiCallTerminationType.UserRequested)
      } catch (_: Throwable) {
        close()
      } finally {
        disposalScope.cancel()
      }
    }
  }

  fun setMicrophoneEnabled(enabled: Boolean) {
    synchronized(stateLock) { webRtcSession }?.setMicrophoneEnabled(enabled)
  }

  fun setSpeakerEnabled(enabled: Boolean) {
    synchronized(stateLock) { webRtcSession }?.setSpeakerEnabled(enabled)
  }

  fun close() {
    val session =
        synchronized(stateLock) {
          webRtcSession.also { webRtcSession = null }
        }
    closeInBackground(session)
  }

  /**
   * Hands WebRTC teardown to [mediaContext] and returns immediately. Disposing the peer
   * connection, the factory and the audio device module blocks until their native
   * threads join, so doing it on the caller's thread stalls the end-of-call screen
   * change. Teardowns are chained so two sessions never release the shared audio route
   * and audio device module at the same time.
   */
  private fun closeInBackground(session: AiCallMediaSession?) {
    if (session == null) {
      return
    }
    // Reading the previous teardown and publishing this one must be one step. Split
    // across two locks, two concurrent closes can both chain onto the same predecessor
    // and release the shared audio route and audio device module at the same time.
    synchronized(stateLock) {
      val previousClose = pendingMediaClose
      pendingMediaClose =
          mediaScope.launch {
            previousClose?.join()
            // mediaScope has no exception handler, so an escaping failure would reach
            // the thread's default handler and take the process down. Teardown is
            // best effort: native disposal and audio route restoration can throw.
            runCatching { session.close() }
          }
    }
  }

  private suspend fun awaitPendingMediaClose() {
    synchronized(stateLock) { pendingMediaClose }?.join()
  }

  private suspend fun abortIfEnding(session: AiCallMediaSession) {
    if (!hasPendingEndRequest()) {
      return
    }
    dispatchPendingEndIfRequested()
    closeSession(session)
    throw CancellationException("The AI call was ended before it connected.")
  }

  private fun closeSession(session: AiCallMediaSession) {
    val shouldClose =
        synchronized(stateLock) {
          if (webRtcSession === session) {
            webRtcSession = null
            true
          } else {
            false
          }
        }
    if (shouldClose) {
      closeInBackground(session)
    }
  }

  private suspend fun dispatchPendingEndIfRequested() {
    val dispatch =
        synchronized(stateLock) {
          if (endRequestSent) {
            null
          } else {
            val terminationType = pendingEndTermination
            val sessionId = callSessionId
            if (terminationType == null || sessionId == null) {
              null
            } else {
              endRequestSent = true
              EndDispatch(terminationType, sessionId)
            }
          }
        } ?: return

    val completion = synchronized(stateLock) { endCompletion }
    try {
      // Reuse the token already held for this call instead of forcing a refresh. A
      // refresh costs a bridge round trip plus /auth/reissue, and on the disposal
      // path the bridge is already detached so nobody answers it and the request
      // burns the provider timeout before /end can be sent. An actually expired
      // token still works: endCallSession retries once on 401 with a fresh token.
      val token =
          accessTokenProvider.currentAccessToken()?.takeIf { it.isNotBlank() }
              ?: accessTokenProvider.refreshAccessToken()
      sessionClient.endCallSession(
          accessToken = token,
          callSessionId = dispatch.callSessionId,
          terminationType = dispatch.terminationType,
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
    pendingEndTermination != null
  }

  private fun currentCallSessionId(): Long? = synchronized(stateLock) { callSessionId }

  private fun completePendingEndWithoutServerSession() {
    synchronized(stateLock) {
      if (pendingEndTermination != null && !endRequestSent && callSessionId == null) {
        endRequestSent = true
        endCompletion?.complete(Unit)
      }
    }
  }
}
