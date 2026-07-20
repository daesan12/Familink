package com.example.realtimevoicepoc

import kotlinx.coroutines.CoroutineScope

enum class CallStatus {
    Idle,
    RequestingPermission,
    Connecting,
    Connected,
    Listening,
    Responding,
    Disconnecting,
    Disconnected,
    Error,
}

data class CallStats(
    val rttMs: Double? = null,
    val jitterMs: Double? = null,
    val packetsReceived: Long? = null,
    val packetsLost: Long? = null,
    val packetLossPercent: Double? = null,
    val jitterBufferDelayMs: Double? = null,
    val inboundAudioBitrateKbps: Double? = null,
)

data class CallUiState(
    val status: CallStatus = CallStatus.Idle,
    val elapsedMs: Long = 0,
    val connectionSetupMs: Long? = null,
    val speechToFirstAudioMs: Long? = null,
    val speechToResponseDoneMs: Long? = null,
    val stats: CallStats = CallStats(),
    val eventLog: List<String> = emptyList(),
    val errorMessage: String? = null,
)

interface CallCallbacks {
    fun onSessionReady()
    fun onRealtimeEvent(event: ParsedRealtimeEvent)
    fun onRemoteAudioFrame()
    fun onStats(stats: CallStats)
    fun onError(message: String)
}

interface RealtimeCallEngine {
    suspend fun connect(scope: CoroutineScope, callbacks: CallCallbacks)

    suspend fun disconnect()

    fun close()
}

