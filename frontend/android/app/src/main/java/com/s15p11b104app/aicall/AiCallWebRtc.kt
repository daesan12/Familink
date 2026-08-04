package com.s15p11b104app.aicall

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import java.io.IOException
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.MediaConstraints
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal data class AiCallCaptionUpdate(
    val text: String,
    val completed: Boolean,
)

internal class AiCallConnectionException(message: String) : IOException(message)

internal interface AiCallMediaSession {
  suspend fun createOffer(): String

  suspend fun setRemoteAnswer(sdpAnswer: String)

  suspend fun awaitConnected(timeoutMillis: Long = 20_000L)

  fun setMicrophoneEnabled(enabled: Boolean)

  fun setSpeakerEnabled(enabled: Boolean)

  fun close()
}

internal class AiCallConnectionStateController(
    private val handler: Handler,
    private val disconnectGracePeriodMillis: Long = DISCONNECT_GRACE_PERIOD_MILLIS,
    private val onConnectionLost: () -> Unit,
) {

  private val stateLock = Any()
  private var hasConnected = false
  private var isClosed = false
  private var isConnectionLostNotified = false
  private var pendingDisconnect: Runnable? = null

  private val connectionLostDispatch =
      Runnable {
        val shouldNotify = synchronized(stateLock) { !isClosed && isConnectionLostNotified }
        if (shouldNotify) {
          onConnectionLost()
        }
      }

  fun onConnected() {
    val pending =
        synchronized(stateLock) {
          if (isClosed) {
            return
          }
          hasConnected = true
          pendingDisconnect.also { pendingDisconnect = null }
        }
    pending?.let(handler::removeCallbacks)
  }

  fun onDisconnected() {
    val pending =
        synchronized(stateLock) {
          if (isClosed || !hasConnected || isConnectionLostNotified || pendingDisconnect != null) {
            return
          }
          object : Runnable {
            override fun run() {
              onDisconnectGraceExpired(this)
            }
          }.also { pendingDisconnect = it }
        }
    handler.postDelayed(pending, disconnectGracePeriodMillis)
  }

  fun onTerminalFailure() {
    val pending =
        synchronized(stateLock) {
          pendingDisconnect.also { pendingDisconnect = null }
        }
    pending?.let(handler::removeCallbacks)
    notifyConnectionLostIfNeeded()
  }

  fun close() {
    val pending =
        synchronized(stateLock) {
          if (isClosed) {
            return
          }
          isClosed = true
          pendingDisconnect.also { pendingDisconnect = null }
        }
    pending?.let(handler::removeCallbacks)
    handler.removeCallbacks(connectionLostDispatch)
  }

  private fun onDisconnectGraceExpired(task: Runnable) {
    val shouldNotify =
        synchronized(stateLock) {
          if (pendingDisconnect !== task) {
            false
          } else {
            pendingDisconnect = null
            true
          }
        }
    if (shouldNotify) {
      notifyConnectionLostIfNeeded()
    }
  }

  private fun notifyConnectionLostIfNeeded() {
    val shouldDispatch =
        synchronized(stateLock) {
          if (isClosed || !hasConnected || isConnectionLostNotified) {
            false
          } else {
            isConnectionLostNotified = true
            true
          }
        }
    if (shouldDispatch) {
      handler.post(connectionLostDispatch)
    }
  }

  companion object {
    internal const val DISCONNECT_GRACE_PERIOD_MILLIS = 5_000L
  }
}

internal class AiCallWebRtcSession(
    context: Context,
    private val onCaptionUpdate: (AiCallCaptionUpdate) -> Unit,
    private val onConnectionLost: () -> Unit,
) : AiCallMediaSession {

  private val appContext = context.applicationContext
  private val mainHandler = Handler(Looper.getMainLooper())
  private val connectionReady = CompletableDeferred<Unit>()
  private val iceGatheringReady = CompletableDeferred<Unit>()
  private val closed = AtomicBoolean(false)

  // Teardown runs off the caller's thread, so it can overlap an SDP operation that a
  // cancelled start coroutine is still finishing. Every native touch takes this lock
  // and rechecks [closed] so a call can never land on a disposed peer connection.
  private val nativeLock = Any()
  private val connectionStateController =
      AiCallConnectionStateController(
          handler = mainHandler,
          onConnectionLost = onConnectionLost,
      )
  private var audioManager: AudioManager? = null
  private var previousAudioMode: Int? = null
  private var previousSpeakerphoneOn: Boolean? = null
  private var audioDeviceModule: AudioDeviceModule? = null
  private var factory: PeerConnectionFactory? = null
  private var audioSource: AudioSource? = null
  private var audioTrack: AudioTrack? = null
  private var peerConnection: PeerConnection? = null
  private var dataChannel: DataChannel? = null

  init {
    try {
      initialize()
    } catch (exception: Throwable) {
      close()
      throw exception
    }
  }

  private fun initialize() {
    PeerConnectionFactory.initialize(
        PeerConnectionFactory.InitializationOptions.builder(appContext)
            .createInitializationOptions()
    )

    val deviceModule = JavaAudioDeviceModule.builder(appContext).createAudioDeviceModule()
    audioDeviceModule = deviceModule
    factory =
        PeerConnectionFactory.builder()
            .setAudioDeviceModule(deviceModule)
            .createPeerConnectionFactory()

    val audioFactory = factory ?: error("WebRTC factory was not created")
    audioSource = audioFactory.createAudioSource(MediaConstraints())
    audioTrack = audioFactory.createAudioTrack(AUDIO_TRACK_ID, audioSource)
    audioTrack?.setEnabled(true)
    configureAudioRoute()

    val observer = createPeerConnectionObserver()
    val configuration =
        PeerConnection.RTCConfiguration(
            listOf(
                PeerConnection.IceServer.builder(DEFAULT_STUN_SERVER).createIceServer()
            )
        )
            .apply { sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN }
    peerConnection =
        audioFactory.createPeerConnection(configuration, observer)
            ?: error("WebRTC peer connection was not created")
    peerConnection?.addTrack(audioTrack, listOf(AUDIO_STREAM_ID))
    dataChannel = peerConnection?.createDataChannel(DATA_CHANNEL_LABEL, DataChannel.Init())
    dataChannel?.registerObserver(createDataChannelObserver())
        ?: error("WebRTC data channel was not created")
  }

  override suspend fun createOffer(): String {
    val connection = peerConnection ?: error("WebRTC peer connection is unavailable")
    val offer =
        awaitSessionDescription { observer ->
          withNativeAccess { connection.createOffer(observer, offerConstraints()) }
        }
    awaitSdpOperation { observer ->
      withNativeAccess { connection.setLocalDescription(observer, offer) }
    }
    awaitIceGatheringComplete()
    return withNativeAccess { connection.localDescription?.description } ?: offer.description
  }

  override suspend fun setRemoteAnswer(sdpAnswer: String) {
    val connection = peerConnection ?: error("WebRTC peer connection is unavailable")
    if (sdpAnswer.isBlank()) {
      throw AiCallConnectionException("The server returned an empty SDP answer.")
    }
    awaitSdpOperation { observer ->
      withNativeAccess {
        connection.setRemoteDescription(
            observer,
            SessionDescription(SessionDescription.Type.ANSWER, sdpAnswer),
        )
      }
    }
  }

  override suspend fun awaitConnected(timeoutMillis: Long) {
    try {
      withTimeout(timeoutMillis) { connectionReady.await() }
    } catch (exception: kotlinx.coroutines.TimeoutCancellationException) {
      throw AiCallConnectionException("WebRTC did not connect within the allowed time.")
    }
  }

  override fun setMicrophoneEnabled(enabled: Boolean) {
    synchronized(nativeLock) {
      if (!closed.get()) {
        audioTrack?.setEnabled(enabled)
      }
    }
  }

  override fun setSpeakerEnabled(enabled: Boolean) {
    synchronized(nativeLock) {
      if (!closed.get()) {
        audioManager?.isSpeakerphoneOn = enabled
      }
    }
  }

  override fun close() {
    if (!closed.compareAndSet(false, true)) {
      return
    }
    connectionStateController.close()
    if (!connectionReady.isCompleted) {
      connectionReady.completeExceptionally(AiCallConnectionException("WebRTC call closed."))
    }
    if (!iceGatheringReady.isCompleted) {
      iceGatheringReady.completeExceptionally(AiCallConnectionException("WebRTC call closed."))
    }
    synchronized(nativeLock) {
      dataChannel?.dispose()
      dataChannel = null
      peerConnection?.close()
      peerConnection?.dispose()
      peerConnection = null
      audioTrack?.dispose()
      audioTrack = null
      audioSource?.dispose()
      audioSource = null
      factory?.dispose()
      factory = null
      audioDeviceModule?.release()
      audioDeviceModule = null
      restoreAudioRoute()
    }
  }

  /**
   * Runs a native peer connection call while teardown is excluded, and refuses it once
   * the session is closed so a cancelled start coroutine cannot resume into disposed
   * native objects.
   */
  private inline fun <T> withNativeAccess(block: () -> T): T =
      synchronized(nativeLock) {
        if (closed.get()) {
          throw AiCallConnectionException("WebRTC call closed.")
        }
        block()
      }

  private fun createPeerConnectionObserver(): PeerConnection.Observer =
      object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState?) = Unit

        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
          when (newState) {
            PeerConnection.IceConnectionState.CONNECTED,
            PeerConnection.IceConnectionState.COMPLETED,
            -> markConnected()

            PeerConnection.IceConnectionState.DISCONNECTED,
            -> connectionStateController.onDisconnected()

            PeerConnection.IceConnectionState.FAILED,
            PeerConnection.IceConnectionState.CLOSED,
            -> connectionStateController.onTerminalFailure()

            else -> Unit
          }
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit

        override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {
          if (newState == PeerConnection.IceGatheringState.COMPLETE &&
              !iceGatheringReady.isCompleted) {
            iceGatheringReady.complete(Unit)
          }
        }

        override fun onIceCandidate(candidate: org.webrtc.IceCandidate?) = Unit

        override fun onIceCandidatesRemoved(candidates: Array<out org.webrtc.IceCandidate>?) = Unit

        override fun onAddStream(stream: org.webrtc.MediaStream?) = Unit

        override fun onRemoveStream(stream: org.webrtc.MediaStream?) = Unit

        override fun onDataChannel(dataChannel: DataChannel?) {
          dataChannel?.registerObserver(createDataChannelObserver())
        }

        override fun onRenegotiationNeeded() = Unit

        override fun onAddTrack(
            receiver: org.webrtc.RtpReceiver?,
            mediaStreams: Array<out org.webrtc.MediaStream>?,
        ) {
          // Safe without [nativeLock]: teardown drains the signaling thread inside
          // peerConnection.close() before disposal, so this cannot touch a freed track.
          // Taking the lock here would deadlock instead, because close() holds it while
          // waiting for this very thread.
          (receiver?.track() as? AudioTrack)?.setVolume(REMOTE_AUDIO_GAIN)
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
          when (newState) {
            PeerConnection.PeerConnectionState.CONNECTED -> markConnected()

            PeerConnection.PeerConnectionState.DISCONNECTED,
            -> connectionStateController.onDisconnected()

            PeerConnection.PeerConnectionState.FAILED,
            PeerConnection.PeerConnectionState.CLOSED,
            -> connectionStateController.onTerminalFailure()

            else -> Unit
          }
        }
      }

  private fun createDataChannelObserver(): DataChannel.Observer =
      object : DataChannel.Observer {
        override fun onBufferedAmountChange(previousAmount: Long) = Unit

        override fun onStateChange() = Unit

        override fun onMessage(buffer: DataChannel.Buffer?) {
          if (buffer == null) {
            return
          }
          val bytes = ByteArray(buffer.data.remaining())
          buffer.data.get(bytes)
          val message = bytes.toString(Charsets.UTF_8)
          val update = parseCaptionUpdate(message) ?: return
          mainHandler.post {
            if (!closed.get()) {
              onCaptionUpdate(update)
            }
          }
        }
      }

  private fun parseCaptionUpdate(message: String): AiCallCaptionUpdate? {
    val payload = runCatching { JSONObject(message) }.getOrNull() ?: return null
    return when (payload.optString("type")) {
      "response.output_audio_transcript.delta" ->
          payload.optString("delta").takeIf { it.isNotEmpty() }?.let {
            AiCallCaptionUpdate(text = it, completed = false)
          }

      "response.output_audio_transcript.done" ->
          payload.optString("transcript").takeIf { it.isNotBlank() }?.let {
            AiCallCaptionUpdate(text = it.trim(), completed = true)
          }

      else -> null
    }
  }

  private fun markConnected() {
    if (closed.get()) {
      return
    }
    connectionStateController.onConnected()
    if (!connectionReady.isCompleted) {
      connectionReady.complete(Unit)
    }
  }

  private suspend fun awaitIceGatheringComplete() {
    val connection = peerConnection ?: error("WebRTC peer connection is unavailable")
    if (withNativeAccess { connection.iceGatheringState() }
        == PeerConnection.IceGatheringState.COMPLETE) {
      return
    }
    try {
      withTimeout(ICE_GATHERING_TIMEOUT_MILLIS) { iceGatheringReady.await() }
    } catch (exception: kotlinx.coroutines.TimeoutCancellationException) {
      throw AiCallConnectionException("WebRTC ICE gathering did not complete in time.")
    }
  }

  private fun configureAudioRoute() {
    val manager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    audioManager = manager
    previousAudioMode = manager.mode
    previousSpeakerphoneOn = manager.isSpeakerphoneOn
    manager.mode = AudioManager.MODE_IN_COMMUNICATION
    manager.isSpeakerphoneOn = true
  }

  private fun restoreAudioRoute() {
    val manager = audioManager ?: return
    previousSpeakerphoneOn?.let { manager.isSpeakerphoneOn = it }
    previousAudioMode?.let { manager.mode = it }
    audioManager = null
  }

  private suspend fun awaitSessionDescription(
      operation: (SdpObserver) -> Unit,
  ): SessionDescription =
      suspendCancellableCoroutine { continuation ->
        operation(
            object : SdpObserver {
              override fun onCreateSuccess(description: SessionDescription?) {
                if (description == null) {
                  continuation.resumeWithException(
                      AiCallConnectionException("WebRTC returned an empty SDP description.")
                  )
                } else {
                  continuation.resume(description)
                }
              }

              override fun onSetSuccess() = Unit

              override fun onCreateFailure(error: String?) {
                continuation.resumeWithException(
                    AiCallConnectionException(error ?: "WebRTC could not create an SDP offer.")
                )
              }

              override fun onSetFailure(error: String?) {
                continuation.resumeWithException(
                    AiCallConnectionException(error ?: "WebRTC SDP operation failed.")
                )
              }
            }
        )
      }

  private suspend fun awaitSdpOperation(operation: (SdpObserver) -> Unit) {
    suspendCancellableCoroutine<Unit> { continuation ->
      operation(
          object : SdpObserver {
            override fun onCreateSuccess(description: SessionDescription?) = Unit

            override fun onSetSuccess() {
              continuation.resume(Unit)
            }

            override fun onCreateFailure(error: String?) {
              continuation.resumeWithException(
                  AiCallConnectionException(error ?: "WebRTC SDP operation failed.")
              )
            }

            override fun onSetFailure(error: String?) {
              continuation.resumeWithException(
                  AiCallConnectionException(error ?: "WebRTC SDP operation failed.")
              )
            }
          }
      )
    }
  }

  private fun offerConstraints(): MediaConstraints =
      MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
      }

  companion object {
    private const val AUDIO_TRACK_ID = "ai-call-audio-track"
    private const val AUDIO_STREAM_ID = "ai-call-audio-stream"
    private const val DATA_CHANNEL_LABEL = "oai-events"
    private const val DEFAULT_STUN_SERVER = "stun:stun.l.google.com:19302"
    private const val ICE_GATHERING_TIMEOUT_MILLIS = 10_000L

    // Playback multiplier for the model's voice. Above 1.0 amplifies; loud passages start
    // clipping well before the 10.0 ceiling WebRTC allows.
    private const val REMOTE_AUDIO_GAIN = 1.5
  }
}
