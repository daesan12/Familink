package com.example.realtimevoicepoc

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
    private val viewModel: CallViewModel by viewModels {
        CallViewModelFactory(
            RealtimeCallClient(
                context = applicationContext,
                backendBaseUrl = BuildConfig.BACKEND_BASE_URL,
            ),
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RealtimeVoiceTheme {
                RealtimeVoiceScreen(viewModel)
            }
        }
    }
}

@Composable
private fun RealtimeVoiceScreen(viewModel: CallViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        viewModel.onMicrophonePermissionResult(granted)
    }
    val isCallInProgress = state.status.isCallInProgress()

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "OpenAI Realtime 음성 대화",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "WebRTC Unified Interface 지연시간 측정 PoC",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            StatusCard(state)

            if (isCallInProgress) {
                Button(
                    onClick = viewModel::stopCall,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError,
                    ),
                ) {
                    Text("통화 종료")
                }
            } else {
                Button(
                    onClick = {
                        val granted = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.RECORD_AUDIO,
                        ) == PackageManager.PERMISSION_GRANTED
                        if (granted) {
                            viewModel.startCall()
                        } else {
                            viewModel.requestMicrophonePermission()
                            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = state.status != CallStatus.RequestingPermission,
                ) {
                    Text("통화 시작")
                }
            }

            state.errorMessage?.let { message ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = message,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            MetricsCard(state)
            EventLogCard(state.eventLog, modifier = Modifier.height(220.dp))
        }
    }
}

@Composable
private fun StatusCard(state: CallUiState) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(statusColor(state.status)),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = statusLabel(state.status),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "연결 경과 시간 ${formatDuration(state.elapsedMs)}",
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun MetricsCard(state: CallUiState) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "측정 지표",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(8.dp))
            MetricRow("connection_setup_ms", state.connectionSetupMs?.toString()?.plus(" ms") ?: "-")
            MetricRow(
                "speech_to_first_audio_ms",
                state.speechToFirstAudioMs?.toString()?.plus(" ms") ?: "-",
            )
            MetricRow(
                "speech_to_response_done_ms",
                state.speechToResponseDoneMs?.toString()?.plus(" ms") ?: "-",
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
            MetricRow("RTT", state.stats.rttMs?.let { "%.1f ms".format(it) } ?: "-")
            MetricRow("jitter", state.stats.jitterMs?.let { "%.1f ms".format(it) } ?: "-")
            MetricRow("packets received", state.stats.packetsReceived?.toString() ?: "-")
            MetricRow("packets lost", state.stats.packetsLost?.toString() ?: "-")
            MetricRow(
                "packet loss",
                state.stats.packetLossPercent?.let { "%.2f%%".format(it) } ?: "-",
            )
            MetricRow(
                "jitter buffer delay",
                state.stats.jitterBufferDelayMs?.let { "%.1f ms".format(it) } ?: "-",
            )
            MetricRow(
                "inbound audio bitrate",
                state.stats.inboundAudioBitrateKbps?.let { "%.1f kbps".format(it) } ?: "-",
            )
            Text(
                text = "첫 음성은 원격 PCM 프레임을 우선 사용하고, 지원되지 않으면 Realtime audio 이벤트로 근사합니다.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun MetricRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun EventLogCard(events: List<String>, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "최근 Realtime 이벤트",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text("최대 80개", style = MaterialTheme.typography.labelSmall)
            }
            if (events.isEmpty()) {
                Text(
                    text = "연결 후 서버 이벤트가 여기에 표시됩니다.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(events.reversed()) { event ->
                        Text(
                            text = event,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(vertical = 3.dp),
                        )
                    }
                }
            }
        }
    }
}

private fun CallStatus.isCallInProgress(): Boolean = this in setOf(
    CallStatus.Connecting,
    CallStatus.Connected,
    CallStatus.Listening,
    CallStatus.Responding,
    CallStatus.Disconnecting,
)

private fun statusLabel(status: CallStatus): String = when (status) {
    CallStatus.Idle -> "대기 중"
    CallStatus.RequestingPermission -> "마이크 권한 요청 중"
    CallStatus.Connecting -> "연결 중"
    CallStatus.Connected -> "연결됨"
    CallStatus.Listening -> "듣는 중"
    CallStatus.Responding -> "AI 응답 중"
    CallStatus.Disconnecting -> "통화 종료 중"
    CallStatus.Disconnected -> "연결 종료됨"
    CallStatus.Error -> "오류"
}

private fun statusColor(status: CallStatus): Color = when (status) {
    CallStatus.Error -> Color(0xFFBA1A1A)
    CallStatus.Connected,
    CallStatus.Listening,
    CallStatus.Responding,
    -> Color(0xFF2E7D32)

    CallStatus.Connecting,
    CallStatus.RequestingPermission,
    CallStatus.Disconnecting,
    -> Color(0xFFB26A00)

    else -> Color(0xFF777777)
}

private fun formatDuration(milliseconds: Long): String {
    val totalSeconds = milliseconds / 1_000L
    return "%02d:%02d".format(totalSeconds / 60L, totalSeconds % 60L)
}
