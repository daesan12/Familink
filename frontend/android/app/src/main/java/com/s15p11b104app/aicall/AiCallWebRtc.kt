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
import kotlinx.coroutines.withTimeoutOrNull
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

  /**
   * 사용자의 음소거 의도를 전달한다.
   *
   * 실제 마이크 전송 여부는 세션이 이 의도와 AI 발화 게이팅을 함께 계산해 결정하므로,
   * `true`를 넣어도 AI가 말하는 동안에는 전송이 재개되지 않는다.
   */
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

/** AI 발화 음성의 재생 구간 경계를 나타내는 신호다. */
internal enum class AiCallGateSignal {
  PlaybackStarted,
  PlaybackEnded,
}

/**
 * Realtime 이벤트 타입을 마이크 게이트 신호로 변환한다.
 *
 * 재생 경계 이벤트만 신호로 쓴다. `response.done`이나
 * `response.output_audio_transcript.done`은 생성 완료 시점이고 재생은 그보다 수 초 더
 * 이어지므로, 해제 신호로 쓰면 정작 끼어들기가 발생하는 구간에서 마이크가 열린다.
 * 반대로 `response.created`처럼 이른 이벤트를 차단 신호로 쓰면 재생 시작 전부터
 * 마이크가 불필요하게 죽는다.
 *
 * `output_audio_buffer.cleared`도 해제로 취급한다. 서버가 남은 재생 오디오를 버렸다는
 * 뜻이라 뒤따를 오디오가 없고, 이 경로에서는 `stopped`가 오지 않을 수 있다.
 */
internal fun aiCallGateSignalOf(eventType: String): AiCallGateSignal? =
    when (eventType) {
      "output_audio_buffer.started" -> AiCallGateSignal.PlaybackStarted
      "output_audio_buffer.stopped",
      "output_audio_buffer.cleared", -> AiCallGateSignal.PlaybackEnded
      else -> null
    }

/**
 * AI 발화가 재생되는 동안 마이크 전송을 막고, 사용자 음소거 의도와 합성해 실효 상태를
 * 계산한다.
 *
 * OpenAI Realtime WebRTC 통화는 사용자 발화가 감지되면 서버가 재생 대기 오디오를
 * 잘라내 AI 음성을 끊는다. 세션 설정의 `interrupt_response`는 응답 생성 취소만 막고 이
 * 재생 버퍼 클리어는 막지 못하므로, 단말이 마이크를 닫아 서버 VAD가 사용자 발화를
 * 감지하지 못하게 하는 것이 유일한 대응이다.
 *
 * 모든 공개 메서드는 어느 스레드에서 호출해도 되며 내부적으로 [handler] 루퍼로 넘긴다.
 * 상태를 메인 루퍼 한 스레드에 가두므로 별도 락이 없다. WebRTC 콜백 스레드에서 네이티브
 * 트랙을 직접 만지면 `close()`가 잡은 락과 교착할 수 있어 이 우회가 필요하다.
 *
 * 불확실한 상황은 모두 마이크가 열리는 쪽으로 수렴시킨다. AI 음성이 한 번 끊기는 것은
 * 품질 문제지만, 마이크가 계속 닫혀 있으면 사용자가 말을 걸 수 없어 통화가 사실상
 * 끝나기 때문이다.
 */
internal class AiCallMicrophoneGateController(
    private val handler: Handler,
    private val tailReleaseDelayMillis: Long = TAIL_RELEASE_DELAY_MILLIS,
    private val maxGateDurationMillis: Long = MAX_GATE_DURATION_MILLIS,
    private val applyMicrophoneEnabled: (Boolean) -> Unit,
) {

  // 세션 생성 시 audioTrack.setEnabled(true)로 시작하므로 초기 실효 상태도 켜짐이다.
  private var userEnabled = true
  private var gateClosed = false
  private var lastApplied = true
  private var isClosed = false
  private var pendingRelease: Runnable? = null

  private val watchdog =
      Runnable {
        if (!isClosed) {
          openGate()
        }
      }

  /** 사용자의 음소거 의도를 기록한다. 실효 상태는 게이트와 함께 계산한다. */
  fun setUserMicrophoneEnabled(enabled: Boolean) = post {
    userEnabled = enabled
    applyEffectiveState()
  }

  fun onPlaybackStarted() = post {
    cancelPendingRelease()
    handler.removeCallbacks(watchdog)
    handler.postDelayed(watchdog, maxGateDurationMillis)
    gateClosed = true
    applyEffectiveState()
  }

  fun onPlaybackEnded() = post {
    if (gateClosed && pendingRelease == null) {
      scheduleRelease()
    }
  }

  /** 연결이 끊기면 재생될 오디오가 없으므로 지연 없이 즉시 해제한다. */
  fun onConnectionInterrupted() = post { openGate() }

  fun close() = post {
    isClosed = true
    cancelPendingRelease()
    handler.removeCallbacks(watchdog)
  }

  /**
   * 서버 버퍼가 비어도 단말 지터 버퍼에 남은 오디오가 잠시 더 재생된다. 그 소리가
   * 마이크로 돌아가 서버 VAD를 잘못 깨우지 않도록 해제를 조금 늦춘다.
   */
  private fun scheduleRelease() {
    val release =
        object : Runnable {
          override fun run() {
            if (pendingRelease === this) {
              pendingRelease = null
              openGate()
            }
          }
        }
    pendingRelease = release
    handler.postDelayed(release, tailReleaseDelayMillis)
  }

  private fun openGate() {
    cancelPendingRelease()
    handler.removeCallbacks(watchdog)
    gateClosed = false
    applyEffectiveState()
  }

  private fun cancelPendingRelease() {
    pendingRelease?.let(handler::removeCallbacks)
    pendingRelease = null
  }

  private fun applyEffectiveState() {
    val effective = userEnabled && !gateClosed
    if (effective == lastApplied) {
      return
    }
    lastApplied = effective
    applyMicrophoneEnabled(effective)
  }

  private inline fun post(crossinline block: () -> Unit) {
    handler.post {
      if (!isClosed) {
        block()
      }
    }
  }

  companion object {
    internal const val TAIL_RELEASE_DELAY_MILLIS = 200L

    // 프롬프트가 한 턴을 "낭독 약 10초"로 지정하므로 정상 재생 최댓값의 설계 목표는
    // 10초다. 여기에 여유를 둔 값이며, 오발동해도 게이팅 전 동작으로 돌아갈 뿐이고
    // 다음 재생 시작에서 다시 무장된다.
    internal const val MAX_GATE_DURATION_MILLIS = 15_000L
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
  private val microphoneGate =
      AiCallMicrophoneGateController(
          handler = mainHandler,
          applyMicrophoneEnabled = ::applyMicrophoneEnabled,
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
    microphoneGate.setUserMicrophoneEnabled(enabled)
  }

  private fun applyMicrophoneEnabled(enabled: Boolean) {
    // 게이트 적용은 이제 발화 경계마다 메인 스레드에서 일어난다. teardown이 [nativeLock]을
    // 쥔 채 네이티브 스레드 조인을 기다리는 동안 여기서 락을 기다리면 메인 스레드가 그만큼
    // 멈추므로, 이미 닫힌 세션은 락에 접근하기 전에 걸러낸다.
    if (closed.get()) {
      return
    }
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
    microphoneGate.close()
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
            -> {
              microphoneGate.onConnectionInterrupted()
              connectionStateController.onDisconnected()
            }

            PeerConnection.IceConnectionState.FAILED,
            PeerConnection.IceConnectionState.CLOSED,
            -> {
              microphoneGate.onConnectionInterrupted()
              connectionStateController.onTerminalFailure()
            }

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
            -> {
              microphoneGate.onConnectionInterrupted()
              connectionStateController.onDisconnected()
            }

            PeerConnection.PeerConnectionState.FAILED,
            PeerConnection.PeerConnectionState.CLOSED,
            -> {
              microphoneGate.onConnectionInterrupted()
              connectionStateController.onTerminalFailure()
            }

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
          val payload = runCatching { JSONObject(message) }.getOrNull() ?: return
          val eventType = payload.optString("type")
          when (aiCallGateSignalOf(eventType)) {
            AiCallGateSignal.PlaybackStarted -> microphoneGate.onPlaybackStarted()
            AiCallGateSignal.PlaybackEnded -> microphoneGate.onPlaybackEnded()
            null -> Unit
          }
          val update = parseCaptionUpdate(payload, eventType) ?: return
          mainHandler.post {
            if (!closed.get()) {
              onCaptionUpdate(update)
            }
          }
        }
      }

  private fun parseCaptionUpdate(payload: JSONObject, eventType: String): AiCallCaptionUpdate? =
      when (eventType) {
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
    // Some emulators keep ICE gathering in GATHERING when the public STUN server is
    // unreachable even though localDescription already contains a usable offer. ICE
    // can continue after the SDP exchange, so a missing COMPLETE callback must not
    // prevent the call-session request from ever reaching the server.
    withTimeoutOrNull(ICE_GATHERING_TIMEOUT_MILLIS) { iceGatheringReady.await() }
  }

  private fun configureAudioRoute() {
    val manager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    audioManager = manager
    previousAudioMode = manager.mode
    previousSpeakerphoneOn = manager.isSpeakerphoneOn
    manager.mode = AudioManager.MODE_IN_COMMUNICATION
    // 통화는 일반 전화와 같이 수화기로 시작한다. 화면의 스피커 기본 상태와 일치해야 한다.
    manager.isSpeakerphoneOn = AI_CALL_DEFAULT_IS_SPEAKER_ON
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
