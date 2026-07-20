package com.example.realtimevoicepoc

import android.content.Context
import android.media.AudioManager
import android.os.Build
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.AudioTrackSink
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RTCStats
import org.webrtc.RTCStatsCollectorCallback
import org.webrtc.RTCStatsReport
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.JavaAudioDeviceModule
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class RealtimeCallClient(
    private val context: Context,
    private val backendBaseUrl: String,
    private val voice: String = "marin",
) : RealtimeCallEngine {
    private var factory: PeerConnectionFactory? = null
    private var audioSource: AudioSource? = null
    private var localAudioTrack: AudioTrack? = null
    private var remoteAudioTrack: AudioTrack? = null
    private var remoteAudioSink: AudioTrackSink? = null
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null
    @Volatile
    private var callbacks: CallCallbacks? = null
    private var statsJob: Job? = null
    private var iceGatheringContinuation: CancellableContinuation<Unit>? = null
    @Volatile
    private var peerConnected = false
    @Volatile
    private var dataChannelOpen = false
    @Volatile
    private var sessionUpdateSent = false
    @Volatile
    private var sessionUpdateAcked = false
    @Volatile
    private var sessionReadyNotified = false
    private var previousBytesReceived: Long? = null
    private var previousStatsNanos: Long? = null
    private var previousAudioManagerMode: Int? = null
    private var previousSpeakerphoneState: Boolean? = null
    private var previousVoiceCallVolume: Int? = null
    private val responseStateLock = Any()
    private var responseInProgress = false
    private var responseCreatePending = false
    private var responseRequestPending = false

    override suspend fun connect(scope: CoroutineScope, callbacks: CallCallbacks) {
        releaseResources()
        this.callbacks = callbacks

        configureAudioRouting()
        initializeFactory()

        val peer = createPeerConnection()
        peerConnection = peer

        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
        }
        val source = checkNotNull(factory).createAudioSource(audioConstraints)
        val track = checkNotNull(factory).createAudioTrack("local-audio", source)
        audioSource = source
        localAudioTrack = track
        peer.addTrack(track, listOf("local-stream"))

        val channel = peer.createDataChannel("oai-events", DataChannel.Init().apply { ordered = true })
        dataChannel = channel
        registerDataChannel(channel)

        val offer = peer.awaitCreateOffer()
        peer.awaitSetLocalDescription(offer)
        withTimeout(10_000L) { awaitIceGatheringComplete(peer) }

        val localSdp = peer.localDescription?.description ?: offer.description
        val answerSdp = requestSdpAnswer(localSdp)
        peer.awaitSetRemoteDescription(SessionDescription(SessionDescription.Type.ANSWER, answerSdp))
        startStatsPolling(scope)
    }

    override suspend fun disconnect() {
        releaseResources()
    }

    override fun close() {
        releaseResources()
    }

    private fun initializeFactory() {
        if (factory != null) return

        if (factoryInitialized.compareAndSet(false, true)) {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context)
                    .setEnableInternalTracer(false)
                    .createInitializationOptions(),
            )
        }

        val audioDeviceModuleBuilder = JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
        if (isEmulator()) {
            // The emulator forces WebRTC to 8 kHz unless an output rate is supplied.
            // Use the native 48 kHz output path to avoid an unnecessary 8 -> 48 kHz
            // resampling step that makes the remote voice sound quiet and distorted.
            audioDeviceModuleBuilder.setOutputSampleRate(OUTPUT_SAMPLE_RATE_HZ)
        }
        val audioDeviceModule = audioDeviceModuleBuilder.createAudioDeviceModule()
        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioDeviceModule)
            .createPeerConnectionFactory()
        audioDeviceModule.release()
    }

    private fun createPeerConnection(): PeerConnection {
        val configuration = PeerConnection.RTCConfiguration(emptyList()).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        return checkNotNull(checkNotNull(factory).createPeerConnection(configuration, peerObserver))
    }

    private val peerObserver = object : PeerConnection.Observer {
        override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit

        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            when (state) {
                PeerConnection.IceConnectionState.CONNECTED,
                PeerConnection.IceConnectionState.COMPLETED,
                -> {
                    peerConnected = true
                    notifySessionReadyIfPossible()
                }

                PeerConnection.IceConnectionState.FAILED ->
                    callbacks?.onError("ICE 연결에 실패했습니다.")

                else -> Unit
            }
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit

        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
            if (state == PeerConnection.IceGatheringState.COMPLETE) {
                iceGatheringContinuation?.let { continuation ->
                    iceGatheringContinuation = null
                    continuation.resume(Unit)
                }
            }
        }

        override fun onIceCandidate(candidate: IceCandidate) = Unit

        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit

        override fun onAddStream(stream: MediaStream) = Unit

        override fun onRemoveStream(stream: MediaStream) = Unit

        override fun onDataChannel(channel: DataChannel) {
            if (dataChannel == null) {
                dataChannel = channel
                registerDataChannel(channel)
            }
        }

        override fun onRenegotiationNeeded() = Unit

        override fun onAddTrack(receiver: RtpReceiver, mediaStreams: Array<out MediaStream>) {
            attachRemoteAudio(receiver.track())
        }

        override fun onTrack(transceiver: RtpTransceiver) {
            attachRemoteAudio(transceiver.receiver.track())
        }

        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
            when (newState) {
                PeerConnection.PeerConnectionState.CONNECTED -> {
                    peerConnected = true
                    notifySessionReadyIfPossible()
                }

                PeerConnection.PeerConnectionState.FAILED ->
                    callbacks?.onError("WebRTC 연결에 실패했습니다.")

                else -> Unit
            }
        }
    }

    private fun attachRemoteAudio(track: MediaStreamTrack?) {
        val audioTrack = track as? AudioTrack ?: return
        remoteAudioTrack?.let { previousTrack ->
            remoteAudioSink?.let(previousTrack::removeSink)
            previousTrack.setEnabled(false)
        }
        audioTrack.setEnabled(true)
        val sink = object : AudioTrackSink {
            override fun onData(
                audioData: ByteBuffer,
                bitsPerSample: Int,
                sampleRate: Int,
                numberOfChannels: Int,
                numberOfFrames: Int,
                absoluteCaptureTimestampMs: Long,
            ) {
                callbacks?.onRemoteAudioFrame()
            }
        }
        remoteAudioTrack = audioTrack
        remoteAudioSink = sink
        audioTrack.addSink(sink)
    }

    private fun registerDataChannel(channel: DataChannel) {
        channel.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) = Unit

            override fun onStateChange() {
                when (channel.state()) {
                    DataChannel.State.OPEN -> {
                        dataChannelOpen = true
                        sendSessionUpdate(channel)
                        notifySessionReadyIfPossible()
                    }

                    DataChannel.State.CLOSED -> callbacks?.onError("Realtime DataChannel이 닫혔습니다.")
                    else -> Unit
                }
            }

            override fun onMessage(buffer: DataChannel.Buffer) {
                val bytes = ByteArray(buffer.data.remaining())
                buffer.data.get(bytes)
                val event = RealtimeEventParser.parse(String(bytes, StandardCharsets.UTF_8))
                if (event != null) {
                    when (event.type) {
                        "input_audio_buffer.speech_stopped" -> handleSpeechStopped(channel)
                        "response.created" -> handleResponseStarted()
                        "response.done" -> handleResponseDone(channel)
                        "error" -> handleRealtimeError()
                    }
                }
                if (event?.kind == RealtimeEventKind.SessionUpdated) {
                    sessionUpdateAcked = true
                    notifySessionReadyIfPossible()
                }
                if (event != null) callbacks?.onRealtimeEvent(event)
            }
        })
    }

    private fun handleSpeechStopped(channel: DataChannel) {
        val shouldCreateResponse = synchronized(responseStateLock) {
            if (responseInProgress || responseCreatePending) {
                responseRequestPending = true
                false
            } else {
                responseCreatePending = true
                true
            }
        }
        if (shouldCreateResponse) sendResponseCreate(channel)
    }

    private fun handleResponseStarted() {
        synchronized(responseStateLock) {
            responseInProgress = true
            responseCreatePending = false
        }
    }

    private fun handleResponseDone(channel: DataChannel) {
        val shouldCreateResponse = synchronized(responseStateLock) {
            responseInProgress = false
            if (responseRequestPending) {
                responseRequestPending = false
                responseCreatePending = true
                true
            } else {
                false
            }
        }
        if (shouldCreateResponse) sendResponseCreate(channel)
    }

    private fun handleRealtimeError() {
        synchronized(responseStateLock) {
            responseCreatePending = false
        }
    }

    private fun sendResponseCreate(channel: DataChannel) {
        val event = JSONObject().put("type", "response.create").toString()
        val sent = channel.send(
            DataChannel.Buffer(ByteBuffer.wrap(event.toByteArray(StandardCharsets.UTF_8)), false),
        )
        if (!sent) {
            synchronized(responseStateLock) {
                responseCreatePending = false
            }
            callbacks?.onError("Realtime 응답 생성을 요청하지 못했습니다.")
        }
    }

    private fun sendSessionUpdate(channel: DataChannel) {
        val event = JSONObject().apply {
            put("type", "session.update")
            put(
                "session",
                JSONObject().apply {
                    put("type", "realtime")
                    put("output_modalities", org.json.JSONArray().put("audio"))
                    put(
                        "instructions",
                        "한국어로 짧고 자연스럽게 대화하세요. 응답은 명확하고 간결하게 하세요.",
                    )
                    put(
                        "audio",
                        JSONObject().apply {
                            put(
                                "input",
                                JSONObject().put(
                                    "turn_detection",
                                    JSONObject().apply {
                                        put("type", "server_vad")
                                        put("threshold", 0.7)
                                        put("prefix_padding_ms", 300)
                                        put("silence_duration_ms", 900)
                                        put("create_response", false)
                                        put("interrupt_response", false)
                                    },
                                ),
                            )
                            put("output", JSONObject().put("voice", voice))
                        },
                    )
                },
            )
        }.toString()
        val sent = channel.send(
            DataChannel.Buffer(ByteBuffer.wrap(event.toByteArray(StandardCharsets.UTF_8)), false),
        )
        if (!sent) {
            callbacks?.onError("Realtime 세션 설정을 전송하지 못했습니다.")
            return
        }
        sessionUpdateSent = true
    }

    private fun notifySessionReadyIfPossible() {
        if (peerConnected && dataChannelOpen && sessionUpdateSent && sessionUpdateAcked && !sessionReadyNotified) {
            sessionReadyNotified = true
            callbacks?.onSessionReady()
        }
    }

    private fun startStatsPolling(scope: CoroutineScope) {
        val peer = peerConnection ?: return
        statsJob?.cancel()
        statsJob = scope.launch {
            while (isActive) {
                delay(1_000L)
                val stats = runCatching { peer.awaitStats() }.getOrNull() ?: continue
                callbacks?.onStats(stats)
            }
        }
    }

    private suspend fun PeerConnection.awaitStats(): CallStats =
        suspendCancellableCoroutine { continuation ->
            getStats(object : RTCStatsCollectorCallback {
                override fun onStatsDelivered(report: RTCStatsReport) {
                    if (continuation.isActive) continuation.resume(parseStats(report))
                }
            })
        }

    private fun parseStats(report: RTCStatsReport): CallStats {
        var rttMs: Double? = null
        var jitterMs: Double? = null
        var packetsReceived: Long? = null
        var packetsLost: Long? = null
        var jitterBufferDelayMs: Double? = null
        var bytesReceived: Long? = null

        report.statsMap.values.forEach { stat: RTCStats ->
            val members = stat.members
            when (stat.type) {
                "candidate-pair" -> {
                    rttMs = members.number("currentRoundTripTime")?.times(1_000.0) ?: rttMs
                }

                "remote-inbound-rtp" -> {
                    rttMs = members.number("roundTripTime")?.times(1_000.0) ?: rttMs
                }

                "inbound-rtp" -> {
                    val kind = members.string("kind") ?: members.string("mediaType")
                    if (kind == "audio") {
                        jitterMs = members.number("jitter")?.times(1_000.0)
                        packetsReceived = members.long("packetsReceived")
                        packetsLost = members.long("packetsLost")
                        bytesReceived = members.long("bytesReceived")
                        val delay = members.number("jitterBufferDelay")
                        val emitted = members.number("jitterBufferEmittedCount")
                        if (delay != null && emitted != null && emitted > 0) {
                            jitterBufferDelayMs = delay / emitted * 1_000.0
                        }
                    }
                }
            }
        }

        val nowNanos = System.nanoTime()
        val bitrate = if (bytesReceived != null && previousBytesReceived != null && previousStatsNanos != null) {
            val seconds = (nowNanos - checkNotNull(previousStatsNanos)) / 1_000_000_000.0
            if (seconds > 0) {
                (bytesReceived - checkNotNull(previousBytesReceived)) * 8.0 / seconds / 1_000.0
            } else {
                null
            }
        } else {
            null
        }
        previousBytesReceived = bytesReceived
        previousStatsNanos = nowNanos

        val received = packetsReceived ?: 0L
        val lost = packetsLost ?: 0L
        val packetLossPercent = if (received + lost > 0) lost * 100.0 / (received + lost) else null
        return CallStats(
            rttMs = rttMs,
            jitterMs = jitterMs,
            packetsReceived = packetsReceived,
            packetsLost = packetsLost,
            packetLossPercent = packetLossPercent,
            jitterBufferDelayMs = jitterBufferDelayMs,
            inboundAudioBitrateKbps = bitrate,
        )
    }

    private suspend fun awaitIceGatheringComplete(peer: PeerConnection) {
        if (peer.iceGatheringState() == PeerConnection.IceGatheringState.COMPLETE) return
        suspendCancellableCoroutine { continuation ->
            iceGatheringContinuation = continuation
            continuation.invokeOnCancellation {
                if (iceGatheringContinuation === continuation) iceGatheringContinuation = null
            }
            if (peer.iceGatheringState() == PeerConnection.IceGatheringState.COMPLETE) {
                iceGatheringContinuation = null
                continuation.resume(Unit)
            }
        }
    }

    private suspend fun requestSdpAnswer(offerSdp: String): String = withContext(Dispatchers.IO) {
        val connection = URL("${backendBaseUrl.trimEnd('/')}/realtime/session")
            .openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 60_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/sdp")
            connection.setRequestProperty("Accept", "application/sdp")
            connection.outputStream.use { output ->
                output.write(offerSdp.toByteArray(StandardCharsets.UTF_8))
            }

            val responseCode = connection.responseCode
            if (responseCode !in 200..299) {
                throw IOException("Backend returned HTTP $responseCode")
            }
            val answer = connection.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
            if (answer.isBlank()) throw IOException("Backend returned an empty SDP answer")
            answer
        } finally {
            connection.disconnect()
        }
    }

    private suspend fun PeerConnection.awaitCreateOffer(): SessionDescription =
        suspendCancellableCoroutine { continuation ->
            createOffer(
                object : SdpObserver {
                    override fun onCreateSuccess(description: SessionDescription) {
                        if (continuation.isActive) continuation.resume(description)
                    }

                    override fun onSetSuccess() = Unit

                    override fun onCreateFailure(error: String) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(IOException("SDP offer 생성 실패: $error"))
                        }
                    }

                    override fun onSetFailure(error: String) = Unit
                },
                MediaConstraints(),
            )
        }

    private suspend fun PeerConnection.awaitSetLocalDescription(description: SessionDescription) {
        suspendSetDescription { observer -> setLocalDescription(observer, description) }
    }

    private suspend fun PeerConnection.awaitSetRemoteDescription(description: SessionDescription) {
        suspendSetDescription { observer -> setRemoteDescription(observer, description) }
    }

    private suspend fun suspendSetDescription(action: (SdpObserver) -> Unit) {
        suspendCancellableCoroutine { continuation ->
            action(
                object : SdpObserver {
                    override fun onCreateSuccess(description: SessionDescription) = Unit

                    override fun onSetSuccess() {
                        if (continuation.isActive) continuation.resume(Unit)
                    }

                    override fun onCreateFailure(error: String) = Unit

                    override fun onSetFailure(error: String) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(IOException("SDP description 적용 실패: $error"))
                        }
                    }
                },
            )
        }
    }

    private fun configureAudioRouting() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        previousAudioManagerMode = audioManager.mode
        previousSpeakerphoneState = audioManager.isSpeakerphoneOn
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = true

        if (isEmulator() && !audioManager.isVolumeFixed) {
            previousVoiceCallVolume = audioManager.getStreamVolume(AudioManager.STREAM_VOICE_CALL)
            audioManager.setStreamVolume(
                AudioManager.STREAM_VOICE_CALL,
                audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL),
                0,
            )
        }
    }

    private fun restoreAudioRouting() {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        previousAudioManagerMode?.let { audioManager.mode = it }
        previousSpeakerphoneState?.let { audioManager.isSpeakerphoneOn = it }
        if (isEmulator() && !audioManager.isVolumeFixed) {
            previousVoiceCallVolume?.let {
                audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL, it, 0)
            }
        }
        previousAudioManagerMode = null
        previousSpeakerphoneState = null
        previousVoiceCallVolume = null
    }

    private fun releaseResources() {
        statsJob?.cancel()
        statsJob = null
        iceGatheringContinuation?.cancel()
        iceGatheringContinuation = null

        dataChannel?.unregisterObserver()
        dataChannel?.dispose()
        dataChannel = null

        remoteAudioTrack?.let { track ->
            remoteAudioSink?.let(track::removeSink)
            track.setEnabled(false)
        }
        remoteAudioSink = null
        remoteAudioTrack = null

        localAudioTrack?.setEnabled(false)
        localAudioTrack?.dispose()
        localAudioTrack = null
        audioSource?.dispose()
        audioSource = null

        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null
        factory?.dispose()
        factory = null

        peerConnected = false
        dataChannelOpen = false
        sessionUpdateSent = false
        sessionUpdateAcked = false
        sessionReadyNotified = false
        previousBytesReceived = null
        previousStatsNanos = null
        synchronized(responseStateLock) {
            responseInProgress = false
            responseCreatePending = false
            responseRequestPending = false
        }
        callbacks = null
        restoreAudioRouting()
    }

    private companion object {
        const val OUTPUT_SAMPLE_RATE_HZ = 48_000
        val factoryInitialized = AtomicBoolean(false)

        fun isEmulator(): Boolean {
            val fingerprint = Build.FINGERPRINT
            val model = Build.MODEL
            return fingerprint.startsWith("generic") ||
                fingerprint.contains("emulator", ignoreCase = true) ||
                model.contains("emulator", ignoreCase = true) ||
                model.contains("sdk_gphone", ignoreCase = true)
        }
    }
}

private fun Map<String, Any>.number(key: String): Double? = (this[key] as? Number)?.toDouble()

private fun Map<String, Any>.long(key: String): Long? = (this[key] as? Number)?.toLong()

private fun Map<String, Any>.string(key: String): String? = this[key] as? String
