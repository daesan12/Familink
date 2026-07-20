package com.example.realtimevoicepoc

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test

@kotlinx.coroutines.ExperimentalCoroutinesApi
class CallViewModelTest {
    private val dispatcher: TestDispatcher = StandardTestDispatcher()
    private lateinit var engine: FakeEngine
    private lateinit var clock: FakeClock
    private lateinit var viewModel: CallViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        engine = FakeEngine()
        clock = FakeClock()
        viewModel = CallViewModel(engine, clock)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `call transitions and latency metrics use monotonic timestamps`() = runTest(dispatcher) {
        viewModel.startCall()
        runCurrent()
        assertEquals(CallStatus.Connecting, viewModel.uiState.value.status)

        clock.now = 1_000_000_000L
        engine.callbacks?.onSessionReady()
        assertEquals(CallStatus.Connected, viewModel.uiState.value.status)
        assertEquals(1_000L, viewModel.uiState.value.connectionSetupMs)

        engine.callbacks?.onRealtimeEvent(
            ParsedRealtimeEvent(
                type = "input_audio_buffer.speech_started",
                kind = RealtimeEventKind.SpeechStarted,
                summary = "input_audio_buffer.speech_started",
            ),
        )
        clock.now = 2_000_000_000L
        engine.callbacks?.onRealtimeEvent(
            ParsedRealtimeEvent(
                type = "input_audio_buffer.speech_stopped",
                kind = RealtimeEventKind.SpeechStopped,
                summary = "input_audio_buffer.speech_stopped",
            ),
        )
        clock.now = 2_250_000_000L
        engine.callbacks?.onRemoteAudioFrame()
        clock.now = 2_750_000_000L
        engine.callbacks?.onRealtimeEvent(
            ParsedRealtimeEvent(
                type = "response.done",
                kind = RealtimeEventKind.ResponseDone,
                summary = "response.done",
            ),
        )

        assertEquals(250L, viewModel.uiState.value.speechToFirstAudioMs)
        assertEquals(750L, viewModel.uiState.value.speechToResponseDoneMs)

        viewModel.stopCall()
        advanceUntilIdle()
        assertEquals(CallStatus.Disconnected, viewModel.uiState.value.status)
        assertEquals(true, engine.disconnected)
    }

    @Test
    fun `permission denial becomes retryable error`() {
        viewModel.requestMicrophonePermission()
        viewModel.onMicrophonePermissionResult(false)

        assertEquals(CallStatus.Error, viewModel.uiState.value.status)
        assertNotNull(viewModel.uiState.value.errorMessage)
    }

    @Test
    fun `engine errors disconnect resources`() = runTest(dispatcher) {
        viewModel.startCall()
        runCurrent()

        engine.callbacks?.onError("Realtime error")
        advanceUntilIdle()

        assertEquals(CallStatus.Error, viewModel.uiState.value.status)
        assertEquals(true, engine.disconnected)
        assertEquals(1, engine.disconnectCalls)
    }
}

private class FakeClock : MonotonicClock {
    var now: Long = 0L

    override fun nowNanos(): Long = now
}

private class FakeEngine : RealtimeCallEngine {
    var callbacks: CallCallbacks? = null
    var disconnected: Boolean? = null
    var disconnectCalls: Int = 0
    private var connectionJob: Job? = null

    override suspend fun connect(scope: CoroutineScope, callbacks: CallCallbacks) {
        this.callbacks = callbacks
        connectionJob = Job()
        connectionJob?.join()
    }

    override suspend fun disconnect() {
        disconnected = true
        disconnectCalls += 1
        connectionJob?.cancel()
    }

    override fun close() {
        disconnected = true
        connectionJob?.cancel()
    }
}
