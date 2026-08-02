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

internal class AiCallWebRtcSession(
    context: Context,
    private val onCaptionUpdate: (AiCallCaptionUpdate) -> Unit,
    private val onConnectionLost: () -> Unit,
) {

  private val appContext = context.applicationContext
  private val mainHandler = Handler(Looper.getMainLooper())
  private val connectionReady = CompletableDeferred<Unit>()
  private val iceGatheringReady = CompletableDeferred<Unit>()
  private val connectionLostNotified = AtomicBoolean(false)
  private val closed = AtomicBoolean(false)
  private var hasConnected = false
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

  suspend fun createOffer(): String {
    val connection = peerConnection ?: error("WebRTC peer connection is unavailable")
    val offer =
        awaitSessionDescription { observer ->
          connection.createOffer(observer, offerConstraints())
        }
    awaitSdpOperation { observer -> connection.setLocalDescription(observer, offer) }
    awaitIceGatheringComplete()
    return connection.localDescription?.description ?: offer.description
  }

  suspend fun setRemoteAnswer(sdpAnswer: String) {
    val connection = peerConnection ?: error("WebRTC peer connection is unavailable")
    if (sdpAnswer.isBlank()) {
      throw AiCallConnectionException("The server returned an empty SDP answer.")
    }
    awaitSdpOperation { observer ->
      connection.setRemoteDescription(
          observer,
          SessionDescription(SessionDescription.Type.ANSWER, sdpAnswer),
      )
    }
  }

  suspend fun awaitConnected(timeoutMillis: Long = CONNECTION_TIMEOUT_MILLIS) {
    try {
      withTimeout(timeoutMillis) { connectionReady.await() }
    } catch (exception: kotlinx.coroutines.TimeoutCancellationException) {
      throw AiCallConnectionException("WebRTC did not connect within the allowed time.")
    }
  }

  fun setMicrophoneEnabled(enabled: Boolean) {
    audioTrack?.setEnabled(enabled)
  }

  fun setSpeakerEnabled(enabled: Boolean) {
    audioManager?.isSpeakerphoneOn = enabled
  }

  fun close() {
    if (!closed.compareAndSet(false, true)) {
      return
    }
    if (!connectionReady.isCompleted) {
      connectionReady.completeExceptionally(AiCallConnectionException("WebRTC call closed."))
    }
    if (!iceGatheringReady.isCompleted) {
      iceGatheringReady.completeExceptionally(AiCallConnectionException("WebRTC call closed."))
    }
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

  private fun createPeerConnectionObserver(): PeerConnection.Observer =
      object : PeerConnection.Observer {
        override fun onSignalingChange(newState: PeerConnection.SignalingState?) = Unit

        override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
          when (newState) {
            PeerConnection.IceConnectionState.CONNECTED,
            PeerConnection.IceConnectionState.COMPLETED,
            -> markConnected()

            PeerConnection.IceConnectionState.FAILED,
            PeerConnection.IceConnectionState.DISCONNECTED,
            PeerConnection.IceConnectionState.CLOSED,
            -> notifyConnectionLostIfNeeded()

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
        ) = Unit

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
          when (newState) {
            PeerConnection.PeerConnectionState.CONNECTED -> markConnected()

            PeerConnection.PeerConnectionState.FAILED,
            PeerConnection.PeerConnectionState.DISCONNECTED,
            PeerConnection.PeerConnectionState.CLOSED,
            -> notifyConnectionLostIfNeeded()

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
    hasConnected = true
    if (!connectionReady.isCompleted) {
      connectionReady.complete(Unit)
    }
  }

  private fun notifyConnectionLostIfNeeded() {
    if (closed.get() || !hasConnected || !connectionLostNotified.compareAndSet(false, true)) {
      return
    }
    mainHandler.post(onConnectionLost)
  }

  private suspend fun awaitIceGatheringComplete() {
    val connection = peerConnection ?: error("WebRTC peer connection is unavailable")
    if (connection.iceGatheringState() == PeerConnection.IceGatheringState.COMPLETE) {
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
    private const val CONNECTION_TIMEOUT_MILLIS = 20_000L
  }
}
