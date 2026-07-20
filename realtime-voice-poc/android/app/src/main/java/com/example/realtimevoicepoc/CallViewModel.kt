package com.example.realtimevoicepoc

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class CallViewModel(
    private val engine: RealtimeCallEngine,
    private val clock: MonotonicClock = AndroidMonotonicClock,
) : ViewModel() {
    private val _uiState = MutableStateFlow(CallUiState())
    val uiState: StateFlow<CallUiState> = _uiState.asStateFlow()

    private var sessionJob: Job? = null
    private var cleanupJob: Job? = null
    private var tickerJob: Job? = null
    private var callStartedAtNanos: Long? = null
    private var sessionActive = false
    private var speechStoppedAtNanos: Long? = null
    private var firstAudioObserved = false
    private var responseDoneObserved = false

    fun requestMicrophonePermission() {
        if (_uiState.value.status.isActiveCall()) return
        _uiState.update {
            it.copy(
                status = CallStatus.RequestingPermission,
                errorMessage = null,
            )
        }
    }

    fun onMicrophonePermissionResult(granted: Boolean) {
        if (granted) {
            startCall()
        } else {
            _uiState.update {
                it.copy(
                    status = CallStatus.Error,
                    errorMessage = "마이크 권한이 필요합니다. 권한을 허용한 뒤 다시 시도하세요.",
                )
            }
        }
    }

    fun startCall() {
        if (_uiState.value.status.isActiveCall()) return
        resetCallMeasurements()
        sessionActive = true
        callStartedAtNanos = clock.nowNanos()
        _uiState.update {
            it.copy(
                status = CallStatus.Connecting,
                elapsedMs = 0,
                connectionSetupMs = null,
                speechToFirstAudioMs = null,
                speechToResponseDoneMs = null,
                stats = CallStats(),
                eventLog = emptyList(),
                errorMessage = null,
            )
        }
        startElapsedTicker()
        val previousCleanup = cleanupJob
        sessionJob = viewModelScope.launch {
            try {
                previousCleanup?.join()
                if (!sessionActive) return@launch
                engine.connect(this, callbacks)
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                handleError(error.message ?: "통화 연결에 실패했습니다.")
            }
        }
    }

    fun stopCall() {
        if (!_uiState.value.status.isActiveCall()) return
        sessionActive = false
        _uiState.update { it.copy(status = CallStatus.Disconnecting, errorMessage = null) }
        viewModelScope.launch {
            sessionJob?.cancel()
            runCatching { engine.disconnect() }
            sessionJob = null
            stopElapsedTicker()
            _uiState.update { it.copy(status = CallStatus.Disconnected) }
        }
    }

    private val callbacks = object : CallCallbacks {
        override fun onSessionReady() {
            if (!sessionActive) return
            val startedAt = callStartedAtNanos ?: return
            val setupMs = elapsedMillis(startedAt, clock.nowNanos())
            _uiState.update {
                it.copy(
                    status = CallStatus.Connected,
                    connectionSetupMs = setupMs,
                    errorMessage = null,
                )
            }
        }

        override fun onRealtimeEvent(event: ParsedRealtimeEvent) {
            if (!sessionActive) return
            appendEvent(event.summary)
            when (event.kind) {
                RealtimeEventKind.SpeechStarted -> {
                    speechStoppedAtNanos = null
                    firstAudioObserved = false
                    responseDoneObserved = false
                    _uiState.update {
                        it.copy(
                            status = CallStatus.Listening,
                            speechToFirstAudioMs = null,
                            speechToResponseDoneMs = null,
                        )
                    }
                }

                RealtimeEventKind.SpeechStopped -> {
                    speechStoppedAtNanos = clock.nowNanos()
                    firstAudioObserved = false
                    responseDoneObserved = false
                    _uiState.update { it.copy(status = CallStatus.Responding) }
                }

                RealtimeEventKind.ResponseStarted ->
                    _uiState.update { it.copy(status = CallStatus.Responding) }

                RealtimeEventKind.ResponseAudio -> markFirstAudio()

                RealtimeEventKind.ResponseDone -> markResponseDone()

                RealtimeEventKind.SessionUpdated -> Unit

                RealtimeEventKind.Error -> handleError(event.summary)
                RealtimeEventKind.Other -> Unit
            }
        }

        override fun onRemoteAudioFrame() {
            if (!sessionActive) return
            markFirstAudio()
        }

        override fun onStats(stats: CallStats) {
            if (!sessionActive) return
            _uiState.update { it.copy(stats = stats) }
        }

        override fun onError(message: String) {
            if (!sessionActive) return
            handleError(message)
        }
    }

    private fun markFirstAudio() {
        val speechStoppedAt = speechStoppedAtNanos ?: return
        if (firstAudioObserved) return
        firstAudioObserved = true
        _uiState.update {
            it.copy(speechToFirstAudioMs = elapsedMillis(speechStoppedAt, clock.nowNanos()))
        }
    }

    private fun markResponseDone() {
        val speechStoppedAt = speechStoppedAtNanos
        if (!responseDoneObserved && speechStoppedAt != null) {
            responseDoneObserved = true
            _uiState.update {
                it.copy(
                    status = CallStatus.Listening,
                    speechToResponseDoneMs = elapsedMillis(speechStoppedAt, clock.nowNanos()),
                )
            }
        } else {
            _uiState.update { it.copy(status = CallStatus.Listening) }
        }
    }

    private fun handleError(message: String) {
        sessionActive = false
        sessionJob?.cancel()
        stopElapsedTicker()
        _uiState.update {
            it.copy(
                status = CallStatus.Error,
                errorMessage = message.ifBlank { "통화 중 오류가 발생했습니다." },
            )
        }
        cleanupJob?.cancel()
        cleanupJob = viewModelScope.launch {
            runCatching { engine.disconnect() }
        }
    }

    private fun appendEvent(event: String) {
        _uiState.update {
            it.copy(eventLog = (it.eventLog + event).takeLast(MAX_EVENT_LOG_SIZE))
        }
    }

    private fun startElapsedTicker() {
        tickerJob?.cancel()
        tickerJob = viewModelScope.launch {
            while (isActive) {
                val startedAt = callStartedAtNanos
                if (startedAt != null) {
                    _uiState.update { it.copy(elapsedMs = elapsedMillis(startedAt, clock.nowNanos())) }
                }
                delay(1_000L)
            }
        }
    }

    private fun stopElapsedTicker() {
        tickerJob?.cancel()
        tickerJob = null
    }

    private fun resetCallMeasurements() {
        speechStoppedAtNanos = null
        firstAudioObserved = false
        responseDoneObserved = false
    }

    override fun onCleared() {
        sessionActive = false
        tickerJob?.cancel()
        sessionJob?.cancel()
        cleanupJob?.cancel()
        engine.close()
        super.onCleared()
    }

    companion object {
        private const val MAX_EVENT_LOG_SIZE = 80
    }
}

private fun CallStatus.isActiveCall(): Boolean = this in setOf(
    CallStatus.Connecting,
    CallStatus.Connected,
    CallStatus.Listening,
    CallStatus.Responding,
    CallStatus.Disconnecting,
)

class CallViewModelFactory(
    private val engine: RealtimeCallEngine,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (!modelClass.isAssignableFrom(CallViewModel::class.java)) {
            throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
        @Suppress("UNCHECKED_CAST")
        return CallViewModel(engine) as T
    }
}
