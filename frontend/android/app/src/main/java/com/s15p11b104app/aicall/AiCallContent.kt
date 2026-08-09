package com.s15p11b104app.aicall

import android.Manifest
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CallEnd
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive

/** 최신 자막부터 적용할 투명도. 목록을 넘어선 오래된 자막은 마지막 값을 쓴다. */
private val CAPTION_ALPHAS = listOf(1f, 0.45f, 0.2f)

/** 자막 영역 위쪽에서 잘린 글자를 감추는 페이드 높이. */
private val CAPTION_FADE_HEIGHT = 40.dp

private const val CAPTION_PLACEHOLDER = "자막을 기다리는 중입니다"

/** 조작할 수 없는 통화 제어 버튼을 흐리게 보여 줄 때 사용하는 불투명도. */
private const val DISABLED_CONTROL_ALPHA = 0.45f

@Composable
internal fun AiCallRoute(
    apiBaseUrl: String?,
    accessTokenProvider: AiCallAccessTokenProvider,
    onCallResult: (String) -> Unit,
    onFullscreenChange: (Boolean) -> Unit,
) {
  var phase by rememberSaveable { mutableStateOf(AiCallPhase.Selecting) }
  var selectedPersonaId by rememberSaveable { mutableStateOf<Long?>(null) }
  var durationSeconds by rememberSaveable { mutableIntStateOf(0) }
  var isMuted by rememberSaveable { mutableStateOf(AI_CALL_DEFAULT_IS_MUTED) }
  var isSpeakerOn by rememberSaveable { mutableStateOf(AI_CALL_DEFAULT_IS_SPEAKER_ON) }
  var captionDraft by rememberSaveable { mutableStateOf("") }
  var captionHistory by remember { mutableStateOf(emptyList<String>()) }
  var pendingPersonaId by rememberSaveable { mutableStateOf<Long?>(null) }
  var permissionResult by remember { mutableStateOf<Boolean?>(null) }
  var connectionLostSignal by remember { mutableIntStateOf(0) }
  var isEnding by rememberSaveable { mutableStateOf(false) }
  var endedByDurationLimit by rememberSaveable { mutableStateOf(false) }
  var failedEndPhase by remember { mutableStateOf<AiCallPhase?>(null) }
  var failureReason by rememberSaveable { mutableStateOf(AiCallFailureReason.Connection) }
  var hasRequestedMicrophonePermission by rememberSaveable { mutableStateOf(false) }
  var callJob by remember { mutableStateOf<Job?>(null) }

  val coroutineScope = rememberCoroutineScope()
  val context = LocalContext.current
  val sessionClient =
      remember(apiBaseUrl, accessTokenProvider) {
        apiBaseUrl?.let { HttpAiCallSessionClient(it, accessTokenProvider) }
      }
  val callRuntime =
      remember(sessionClient) {
        sessionClient?.let { client ->
          AiCallRuntime(
              context = context,
              sessionClient = client,
              accessTokenProvider = accessTokenProvider,
              onCaptionUpdate = { update ->
                if (update.completed) {
                  val completedCaption =
                      (update.text.ifBlank { captionDraft }).trim()
                  if (completedCaption.isNotBlank()) {
                    captionHistory = (captionHistory + completedCaption).takeLast(3)
                  }
                  captionDraft = ""
                } else {
                  captionDraft += update.text
                }
              },
              onConnectionLost = { connectionLostSignal += 1 },
          )
       }
      }

  val latestCallJob = rememberUpdatedState(callJob)
  DisposableEffect(callRuntime) {
    onDispose {
      latestCallJob.value?.cancel()
      callRuntime?.dispose()
    }
  }

  val permissionLauncher =
      rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        permissionResult = granted
      }
  val settingsLauncher =
      rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED) {
          permissionResult = true
        } else {
          permissionResult = null
          failureReason = AiCallFailureReason.MicrophonePermissionBlocked
          phase = AiCallPhase.Failed
        }
      }

  val selectedPersona = aiPersonas.firstOrNull { it.id == selectedPersonaId }

  LaunchedEffect(phase) {
    onFullscreenChange(phase != AiCallPhase.Selecting)
  }

  LaunchedEffect(connectionLostSignal, phase) {
    if (connectionLostSignal == 0 || phase != AiCallPhase.InProgress || isEnding) {
      return@LaunchedEffect
    }
    isEnding = true
    failedEndPhase = null
    failureReason = AiCallFailureReason.Connection
    phase = AiCallPhase.Failed
    runCatching {
      callRuntime?.end(
          terminationType = AiCallTerminationType.ConnectionLost,
      )
    }
    onCallResult(AiCallResult.Failed.wireValue)
    isEnding = false
  }

  val startCallWithPermission = { personaId: Long ->
    val runtime = callRuntime
    if (runtime == null) {
      failedEndPhase = null
      phase = AiCallPhase.Failed
      onCallResult(AiCallResult.Failed.wireValue)
    } else {
      callJob?.cancel()
      isEnding = false
      endedByDurationLimit = false
      failedEndPhase = null
      failureReason = AiCallFailureReason.Connection
      durationSeconds = 0
      captionDraft = ""
      captionHistory = emptyList()
      // 재시도는 returnToSelection을 거치지 않으므로, 새 세션의 기본 오디오 상태와
      // 어긋나지 않도록 여기서도 토글을 초기화한다.
      isMuted = AI_CALL_DEFAULT_IS_MUTED
      isSpeakerOn = AI_CALL_DEFAULT_IS_SPEAKER_ON
      phase = AiCallPhase.Connecting
      callJob =
          coroutineScope.launch {
            try {
              runtime.start(personaId = personaId)
              phase = AiCallPhase.InProgress
            } catch (exception: CancellationException) {
              throw exception
            } catch (exception: Throwable) {
              failureReason = AiCallFailureReason.Connection
              phase = AiCallPhase.Failed
              onCallResult(AiCallResult.Failed.wireValue)
            }
          }
    }
  }

  LaunchedEffect(permissionResult, pendingPersonaId) {
    val requestedPersonaId = pendingPersonaId ?: return@LaunchedEffect
    val granted = permissionResult ?: return@LaunchedEffect
    permissionResult = null
    if (granted) {
      pendingPersonaId = null
      failureReason = AiCallFailureReason.Connection
      startCallWithPermission(requestedPersonaId)
    } else {
      failedEndPhase = null
      val activity = context.findActivity()
      val shouldShowRationale =
          activity?.let {
            ActivityCompat.shouldShowRequestPermissionRationale(
                it,
                Manifest.permission.RECORD_AUDIO,
            )
          } ?: false
      failureReason =
          if (hasRequestedMicrophonePermission && !shouldShowRationale) {
            AiCallFailureReason.MicrophonePermissionBlocked
          } else {
            AiCallFailureReason.MicrophonePermissionDenied
          }
      phase = AiCallPhase.Failed
      onCallResult(AiCallResult.Failed.wireValue)
    }
  }

  val startCall = { personaId: Long ->
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED) {
      startCallWithPermission(personaId)
    } else {
      pendingPersonaId = personaId
      val activity = context.findActivity()
      val shouldShowRationale =
          activity?.let {
            ActivityCompat.shouldShowRequestPermissionRationale(
                it,
                Manifest.permission.RECORD_AUDIO,
            )
          } ?: false
      if (hasRequestedMicrophonePermission && !shouldShowRationale) {
        failedEndPhase = null
        failureReason = AiCallFailureReason.MicrophonePermissionBlocked
        phase = AiCallPhase.Failed
        onCallResult(AiCallResult.Failed.wireValue)
      } else {
        hasRequestedMicrophonePermission = true
        permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
      }
    }
  }

  val returnToSelection = {
    callJob?.cancel()
    callRuntime?.close()
    isEnding = false
    endedByDurationLimit = false
    failedEndPhase = null
    failureReason = AiCallFailureReason.Connection
    pendingPersonaId = null
    permissionResult = null
    phase = AiCallPhase.Selecting
    durationSeconds = 0
    captionDraft = ""
    captionHistory = emptyList()
    isMuted = AI_CALL_DEFAULT_IS_MUTED
    isSpeakerOn = AI_CALL_DEFAULT_IS_SPEAKER_ON
  }

  val finishCallFromPhase: (AiCallPhase) -> Unit = { endingPhase ->
    if (!isEnding) {
      isEnding = true
      if (endingPhase == AiCallPhase.Connecting) {
        callJob?.cancel()
      }
      phase = AiCallPhase.Ending
      coroutineScope.launch {
        try {
          val result =
              awaitAiCallEndConfirmation(
                  initialPhase = endingPhase,
                  requestEnd = {
                    callRuntime?.end(
                        terminationType = AiCallTerminationType.UserRequested,
                    )
                  },
                  onConfirmed = { confirmed -> phase = confirmed.terminalPhase },
          )
          failedEndPhase = null
          onCallResult(result.wireValue)
        } catch (exception: Throwable) {
          failedEndPhase = endingPhase
          failureReason = AiCallFailureReason.EndRequest
          phase = AiCallPhase.Failed
          onCallResult(AiCallResult.Failed.wireValue)
        } finally {
          isEnding = false
        }
      }
    }
  }

  // 종료를 실제로 시작했는지 알려 준다. 이미 종료 중이거나 활성 단계가 아니면 아무것도 하지 않으므로,
  // 상한 판정처럼 종료를 자기 원인으로 기록해야 하는 호출부가 이 결과로 구분할 수 있다.
  val finishCall = {
    val started = !isEnding && (phase == AiCallPhase.Connecting || phase == AiCallPhase.InProgress)
    if (started) {
      finishCallFromPhase(phase)
    }
    started
  }

  // 통화 시간을 세면서 상한 도달을 함께 판정한다. 상한에 닿으면 종료 버튼과 같은 경로로 끝내므로
  // 서버에는 사용자 종료로 접수되고 통화는 COMPLETED로 마감된다. 사용자가 상한 직전에 종료 버튼을
  // 누르면 이 코루틴이 해제되기 전에 마지막 틱이 돌 수 있으므로, 종료를 실제로 시작했을 때만
  // 시간 만료로 기록해 사용자 종료가 시간 만료로 표시되지 않게 한다.
  LaunchedEffect(phase) {
    if (phase == AiCallPhase.InProgress) {
      while (isActive) {
        delay(1_000)
        durationSeconds += 1
        if (isAiCallDurationLimitReached(durationSeconds)) {
          endedByDurationLimit = finishCall()
          return@LaunchedEffect
        }
      }
    }
  }

  BackHandler(enabled = phase != AiCallPhase.Selecting) {
    when (aiCallBackAction(phase, failureReason == AiCallFailureReason.EndRequest)) {
      AiCallBackAction.Ignore -> Unit
      AiCallBackAction.ReturnToSelection -> returnToSelection()
    }
  }

  AiCallContent(
      state =
          AiCallUiState(
              phase = phase,
              persona = selectedPersona,
              failureReason = failureReason,
              durationSeconds = durationSeconds,
              isMuted = isMuted,
              isSpeakerOn = isSpeakerOn,
              captionDraft = captionDraft,
              captionHistory = captionHistory,
              endedByDurationLimit = endedByDurationLimit,
          ),
      selectedPersonaId = selectedPersonaId,
      onPersonaSelected = { selectedPersonaId = it },
      onStartCall = {
        if (selectedPersona != null) {
          startCall(selectedPersona.id)
        }
      },
      onToggleMute = {
        isMuted = !isMuted
        callRuntime?.setMicrophoneEnabled(!isMuted)
      },
      onToggleSpeaker = {
        isSpeakerOn = !isSpeakerOn
        callRuntime?.setSpeakerEnabled(isSpeakerOn)
      },
      onEndCall = { finishCall() },
      onConfirm = returnToSelection,
      onRetry = {
        when (failureReason) {
          AiCallFailureReason.EndRequest -> {
            failedEndPhase?.let(finishCallFromPhase)
          }

          AiCallFailureReason.MicrophonePermissionBlocked -> {
            settingsLauncher.launch(
                Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:${context.packageName}"),
                )
            )
          }

          AiCallFailureReason.Connection,
          AiCallFailureReason.MicrophonePermissionDenied,
          -> selectedPersona?.let { startCall(it.id) }
        }
      },
  )
}

@Composable
internal fun AiCallContent(
    state: AiCallUiState,
    selectedPersonaId: Long?,
    onPersonaSelected: (Long) -> Unit,
    onStartCall: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleSpeaker: () -> Unit,
    onEndCall: () -> Unit,
    onConfirm: () -> Unit,
    onRetry: () -> Unit,
) {
  when (state.phase) {
    AiCallPhase.Selecting ->
        PersonaSelectionScreen(
            selectedPersonaId = selectedPersonaId,
            onPersonaSelected = onPersonaSelected,
            onStartCall = onStartCall,
        )

    AiCallPhase.Connecting,
    AiCallPhase.InProgress,
    AiCallPhase.Ending,
    ->
        ActiveCallScreen(
            state = state,
            onToggleMute = onToggleMute,
            onToggleSpeaker = onToggleSpeaker,
            onEndCall = onEndCall,
        )

    AiCallPhase.Completed,
    AiCallPhase.Cancelled,
    ->
        CallEndedScreen(
            state = state,
            onConfirm = onConfirm,
        )

    AiCallPhase.Failed ->
        CallFailedScreen(
            persona = state.persona,
            failureReason = state.failureReason,
            onConfirm = onConfirm,
            onRetry = onRetry,
        )
  }
}

@Composable
private fun PersonaSelectionScreen(
    selectedPersonaId: Long?,
    onPersonaSelected: (Long) -> Unit,
    onStartCall: () -> Unit,
) {
  val selectedPersona = aiPersonas.firstOrNull { it.id == selectedPersonaId }
  val context = LocalContext.current
  val animationsEnabled = remember(context) { areSystemAnimationsEnabled(context) }

  Column(
      modifier =
          Modifier.fillMaxSize()
              .background(AiCallColors.Background)
              // 선택 화면은 한 화면에 들어가도록 잡았지만, 화면이 작거나 글꼴을 키운
              // 사용자에게는 넘칠 수 있다. 스크롤을 없애면 그런 기기에서 통화 버튼이
              // 잘려 아예 누를 수 없으므로 남겨 둔다.
              .verticalScroll(rememberScrollState())
              // `통화 시작` 글자를 없애면서 아래에 여백이 남으므로 위쪽을 조금 더 띄워
              // 내용 전체를 살짝 내린다.
              .padding(start = 24.dp, end = 24.dp, top = 26.dp, bottom = 12.dp),
  ) {
    Text(
        text = "오늘은 누구와\n이야기할까요?",
        color = AiCallColors.TextStrong,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 34.sp,
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = "아래 사진을 눌러 대화 상대를 골라보세요",
        color = AiCallColors.TextMuted,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    )
    // 부제와 첫 줄 사진이 붙어 보이지 않게 띄운다. 대신 두 줄 사이 간격을 조금
    // 줄여 늘어난 높이를 상쇄해 한 화면 안에 그대로 머물게 한다.
    Spacer(modifier = Modifier.height(22.dp))

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      aiPersonasForSelection.chunked(3).forEach { rowPersonas ->
        Row(
            modifier = Modifier.fillMaxWidth(),
            // 사진은 칸 폭을 그대로 채운다. 이 간격이 곧 사진 사이의 여백이라
            // 값을 키우면 사진이 작아진다.
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
          rowPersonas.forEach { persona ->
            PersonaItem(
                modifier = Modifier.weight(1f),
                persona = persona,
                selected = persona.id == selectedPersonaId,
                animationsEnabled = animationsEnabled,
                onSelect = { onPersonaSelected(persona.id) },
            )
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(14.dp))
    SelectedPersonaSummary(persona = selectedPersona)

    Spacer(modifier = Modifier.height(12.dp))
    Column(
        modifier = Modifier.align(Alignment.CenterHorizontally),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      val callInteractionSource = remember { MutableInteractionSource() }
      val callPressed by callInteractionSource.collectIsPressedAsState()
      val callScale by
          animateFloatAsState(
              targetValue = if (animationsEnabled && callPressed) 0.96f else 1f,
              animationSpec =
                  spring(
                      dampingRatio = Spring.DampingRatioNoBouncy,
                      stiffness = Spring.StiffnessMedium,
                  ),
              label = "call button press",
          )

      Box(
          modifier = Modifier.size(88.dp).testTag("start-call-depth"),
          contentAlignment = Alignment.Center,
      ) {
        FilledIconButton(
            onClick = onStartCall,
            enabled = selectedPersona != null,
            interactionSource = callInteractionSource,
            modifier =
                Modifier.size(80.dp)
                    .graphicsLayer {
                      scaleX = callScale
                      scaleY = callScale
                    }
                    .shadow(
                        elevation = if (selectedPersona != null) 12.dp else 0.dp,
                        shape = CircleShape,
                        ambientColor = Color.Black.copy(alpha = 0.12f),
                        spotColor = Color.Black.copy(alpha = 0.18f),
                    )
                    .testTag("start-call"),
            colors =
                IconButtonDefaults.filledIconButtonColors(
                    containerColor = Color(0xFF6C5CE7),
                    contentColor = Color.White,
                    disabledContainerColor = AiCallColors.LavenderTint,
                    disabledContentColor = Color.White,
                ),
        ) {
          Icon(
              imageVector = Icons.Rounded.Call,
              contentDescription = "통화 시작",
              modifier = Modifier.size(38.dp),
          )
        }
      }
    }
  }
}

/**
 * 선택한 페르소나의 말투 칩과 소개글.
 *
 * 아무것도 선택하지 않았을 때도 같은 높이를 차지한다. 내용이 있을 때만 그리면 페르소나를 처음 누르는
 * 순간 아래 통화 버튼이 밀려 내려가 화면이 덜컹인다.
 */
@Composable
private fun SelectedPersonaSummary(persona: AiPersona?) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Surface(
        color =
            if (persona == null) {
              Color.Transparent
            } else {
              AiCallColors.LavenderSurface
            },
        shape = RoundedCornerShape(50),
    ) {
      Text(
          text = persona?.toneTag ?: "",
          modifier =
              Modifier.testTag("selected-persona-tag")
                  .padding(horizontal = 14.dp, vertical = 6.dp),
          color = AiCallColors.BrandPurplePressed,
          fontSize = 14.sp,
          fontWeight = FontWeight.SemiBold,
      )
    }
    Spacer(modifier = Modifier.height(10.dp))
    Text(
        text = persona?.introduction ?: "",
        modifier = Modifier.fillMaxWidth().testTag("selected-persona-introduction"),
        color = AiCallColors.TextStrong,
        fontSize = 14.sp,
        lineHeight = 21.sp,
        // 소개글은 넓은 화면에서 두 줄이므로 두 줄을 확보해 선택 전후로 통화 버튼이 움직이지
        // 않게 한다. 좁은 화면에서는 소개글이 더 늘어나 버튼이 아래로 밀리지만, 남겨 둔
        // verticalScroll로 닿을 수 있어 넓은 화면의 여백을 지키는 쪽을 택했다.
        minLines = 2,
    )
  }
}

private fun areSystemAnimationsEnabled(context: Context): Boolean {
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    return ValueAnimator.areAnimatorsEnabled()
  }

  return Settings.Global.getFloat(
      context.contentResolver,
      Settings.Global.ANIMATOR_DURATION_SCALE,
      1f,
  ) > 0f
}

@Composable
private fun PersonaItem(
    modifier: Modifier,
    persona: AiPersona,
    selected: Boolean,
    animationsEnabled: Boolean,
    onSelect: () -> Unit,
) {
  val interactionSource = remember { MutableInteractionSource() }
  val pressed by interactionSource.collectIsPressedAsState()
  val targetScale =
      when {
        !animationsEnabled -> 1f
        pressed -> 0.96f
        selected -> 1.03f
        else -> 1f
      }
  val scale by
      animateFloatAsState(
          targetValue = targetScale,
          animationSpec =
              spring(
                  dampingRatio = Spring.DampingRatioNoBouncy,
                  stiffness = Spring.StiffnessMediumLow,
              ),
          label = "persona selection depth",
      )
  val lift = with(LocalDensity.current) { if (selected && animationsEnabled) (-2).dp.toPx() else 0f }

  Column(
      modifier =
          modifier
              .selectable(
                  selected = selected,
                  interactionSource = interactionSource,
                  indication = null,
                  role = Role.RadioButton,
                  onClick = onSelect,
              )
              .semantics { contentDescription = persona.displayName }
              .testTag("persona-${persona.id}"),
      horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Box(
        modifier =
            // 고정 크기로 두면 좁은 기기에서 세 칸이 넘치고, 칸 폭을 그대로 쓰면 넓은
            // 기기(S10은 411dp)에서 사진이 커져 통화 버튼이 화면 밖으로 밀린다. 칸 폭을
            // 받되 상한을 둬서 두 경우를 모두 막는다.
            // widthIn을 fillMaxWidth보다 먼저 둬야 상한이 걸린다. 순서를 바꾸면
            // fillMaxWidth가 최소·최대를 칸 폭으로 고정해 상한이 무시된다.
            Modifier.widthIn(max = 96.dp)
                .fillMaxWidth()
                .aspectRatio(1f)
                .graphicsLayer {
                  scaleX = scale
                  scaleY = scale
                  translationY = lift
                }
                .testTag("persona-depth-${persona.id}"),
        contentAlignment = Alignment.Center,
    ) {
      Box(
          modifier =
              Modifier.fillMaxSize()
                  .shadow(
                      elevation = if (selected) 7.dp else 2.dp,
                      shape = CircleShape,
                      ambientColor = Color.Black.copy(alpha = if (selected) 0.11f else 0.05f),
                      spotColor = Color.Black.copy(alpha = if (selected) 0.15f else 0.07f),
                  )
                  .background(Color(0xFFF0EEF4), CircleShape)
                  .border(
                      width = if (selected) 2.dp else 1.dp,
                      color =
                          if (selected) {
                            AiCallColors.BrandPurple
                          } else {
                            AiCallColors.LavenderTint
                          },
                      shape = CircleShape,
                  )
                  .padding(if (selected) 4.dp else 2.dp),
          contentAlignment = Alignment.Center,
      ) {
        Image(
            painter = painterResource(persona.imageResource),
            contentDescription = null,
            modifier = Modifier.fillMaxSize().clip(CircleShape),
            contentScale = ContentScale.Crop,
        )
      }
      if (selected) {
        Box(
            modifier =
                Modifier.align(Alignment.BottomEnd)
                    .offset(x = (-1).dp, y = (-1).dp)
                    .size(28.dp)
                    .background(Color.White, CircleShape)
                    .padding(3.dp)
                    .background(AiCallColors.BrandPurple, CircleShape)
                    .testTag("persona-selected-check-${persona.id}"),
            contentAlignment = Alignment.Center,
        ) {
          Icon(
              imageVector = Icons.Rounded.Check,
              contentDescription = null,
              tint = Color.White,
              modifier = Modifier.size(16.dp),
          )
        }
      }
    }
    Spacer(modifier = Modifier.height(7.dp))
    Text(
        text = persona.displayName,
        color =
            if (selected) {
              AiCallColors.BrandPurplePressed
            } else {
              AiCallColors.TextStrong
            },
        fontSize = 14.sp,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
        lineHeight = 19.sp,
        maxLines = 2,
        minLines = 2,
        overflow = TextOverflow.Ellipsis,
        textAlign = TextAlign.Center,
    )
  }
}

@Composable
private fun ActiveCallScreen(
    state: AiCallUiState,
    onToggleMute: () -> Unit,
    onToggleSpeaker: () -> Unit,
    onEndCall: () -> Unit,
) {
  val persona = state.persona ?: return
  val isConnecting = state.phase == AiCallPhase.Connecting
  val isEnding = state.phase == AiCallPhase.Ending
  // 연결 중·종료 중에는 미디어 세션이 없거나 정리되는 중이므로 마이크·스피커를 바꿀 수 없다.
  val isControlEnabled = !isConnecting && !isEnding
  val captionLines = state.captionLines.ifEmpty { listOf(CAPTION_PLACEHOLDER) }

  Column(
      modifier =
          Modifier.fillMaxSize()
              // 위쪽 연보라에서 아래쪽 흰색으로 내려가는 배경. 제어 버튼이 놓이는 아래쪽이
              // 흰색이어야 흰 버튼과 그림자가 또렷하게 읽힌다.
              .background(
                  Brush.verticalGradient(
                      colors = listOf(AiCallColors.LavenderTint, Color.White),
                  )
              )
              .testTag("call-gradient-background")
              .padding(horizontal = 24.dp, vertical = 22.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Image(
        painter = painterResource(persona.imageResource),
        contentDescription = "${persona.displayName} 사진",
        modifier =
            Modifier.size(132.dp)
                .shadow(
                    elevation = 12.dp,
                    shape = CircleShape,
                    ambientColor = Color.Black.copy(alpha = 0.12f),
                    spotColor = Color.Black.copy(alpha = 0.16f),
                )
                .clip(CircleShape),
        contentScale = ContentScale.Crop,
    )
    Spacer(modifier = Modifier.height(14.dp))
    Text(
        text = persona.callName,
        color = AiCallColors.Ink,
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
    )
    Spacer(modifier = Modifier.height(4.dp))
    Text(
        text =
            if (isConnecting) {
              "통화 연결 중"
            } else if (isEnding) {
              "통화 종료 중"
            } else {
              formatCallDuration(state.durationSeconds)
            },
        color = AiCallColors.TextMuted,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.testTag("call-status"),
    )

    Spacer(modifier = Modifier.height(20.dp))
    // 자막이 이 영역을 넘겨도 통화 제어 버튼을 밀어낼 수 없도록 weight를 자막 쪽에 준다. weight가 붙은
    // 자식은 나머지 자식을 모두 배분한 뒤 남은 높이만 받으므로, 버튼은 항상 자기 크기를 먼저 확보한다.
    Box(
        modifier =
            Modifier.fillMaxWidth()
                .weight(1f)
                // clip을 켜야 넘친 자막이 그리기뿐 아니라 레이아웃·시맨틱스 경계에서도 잘린다.
                // 끄면 화면에서 사라진 자막이 접근성 트리에 남아 TalkBack이 함께 읽는다.
                .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen, clip = true)
                .drawWithContent {
                  drawContent()
                  drawRect(
                      brush =
                          Brush.verticalGradient(
                              colors = listOf(Color.Transparent, Color.Black),
                              startY = 0f,
                              endY = CAPTION_FADE_HEIGHT.toPx(),
                          ),
                      blendMode = BlendMode.DstIn,
                  )
                },
        contentAlignment = Alignment.BottomCenter,
    ) {
      if (!isConnecting && !isEnding) {
        CaptionStack(lines = captionLines)
      } else {
        Text(
            text = if (isEnding) "통화 종료 중입니다" else "잠시만 기다려 주세요",
            color = AiCallColors.TextMuted,
            fontSize = 17.sp,
        )
      }
    }

    Spacer(modifier = Modifier.height(30.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
      CallControlButton(
          label = if (state.isSpeakerOn) "스피커 끄기" else "스피커 켜기",
          stateDescription = if (state.isSpeakerOn) "스피커 켜짐" else "스피커 꺼짐",
          accented = state.isSpeakerOn,
          enabled = isControlEnabled,
          onClick = onToggleSpeaker,
      ) {
        // 스피커는 사선 아이콘을 쓰지 않고 색으로만 상태를 구분한다.
        Icon(
            imageVector = Icons.AutoMirrored.Rounded.VolumeUp,
            contentDescription = null,
            modifier = Modifier.size(30.dp),
        )
      }
      CallControlButton(
          label = "통화 종료",
          containerColor = AiCallColors.BrandPurple,
          size = 78.dp,
          // 종료 중에는 finishCall이 이미 no-op이므로 눌리는 것처럼 보이지 않게 한다.
          enabled = !isEnding,
          onClick = onEndCall,
      ) {
        Icon(
            imageVector = Icons.Rounded.CallEnd,
            contentDescription = null,
            modifier = Modifier.size(37.dp),
        )
      }
      CallControlButton(
          label = if (state.isMuted) "음소거 해제" else "음소거",
          stateDescription = if (state.isMuted) "음소거 켜짐" else "음소거 꺼짐",
          accented = state.isMuted,
          enabled = isControlEnabled,
          onClick = onToggleMute,
      ) {
        Icon(
            imageVector =
                if (state.isMuted) {
                  Icons.Rounded.MicOff
                } else {
                  Icons.Rounded.Mic
                },
            contentDescription = null,
            modifier = Modifier.size(29.dp),
        )
      }
    }
  }
}

/**
 * 자막을 오래된 것부터 최신 순으로 아래에 붙여 쌓는다. [Modifier.wrapContentHeight]의 `unbounded`가
 * 높이 제한 없이 측정시키므로 최신 자막은 줄 수와 무관하게 온전히 자리를 잡고, 묶음이 부모 영역보다
 * 커지면 위쪽의 오래된 자막부터 넘쳐서 잘린다. 크기는 모두 같고 최신에서 멀어질수록 투명해진다.
 */
@Composable
private fun CaptionStack(lines: List<String>) {
  Column(
      modifier =
          Modifier.fillMaxWidth()
              .wrapContentHeight(align = Alignment.Bottom, unbounded = true)
              .semantics { liveRegion = LiveRegionMode.Polite }
              .testTag("live-caption"),
      verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    lines.forEachIndexed { index, line ->
      Text(
          text = line,
          color =
              AiCallColors.Ink.copy(
                  alpha =
                      CAPTION_ALPHAS.getOrElse(lines.lastIndex - index) { CAPTION_ALPHAS.last() },
              ),
          fontSize = 27.sp,
          fontWeight = FontWeight.Bold,
          lineHeight = 38.sp,
      )
    }
  }
}

@Composable
private fun CallControlButton(
    label: String,
    onClick: () -> Unit,
    containerColor: Color = Color.White,
    size: androidx.compose.ui.unit.Dp = 64.dp,
    stateDescription: String? = null,
    accented: Boolean = false,
    enabled: Boolean = true,
    icon: @Composable () -> Unit,
) {
  // 켜진 버튼은 글자색으로 꽉 채우고 아이콘을 흰색으로 뒤집는다. 꺼진 버튼은 흰 배경에
  // 글자색 아이콘을 두고, 흰 배경 위에서도 원의 경계가 보이도록 얇은 외곽선을 더한다.
  val resolvedContainer =
      when {
        containerColor != Color.White -> containerColor
        accented -> AiCallColors.Ink
        else -> Color.White
      }
  val isFilled = resolvedContainer != Color.White

  Surface(
      modifier =
          Modifier.size(size).alpha(if (enabled) 1f else DISABLED_CONTROL_ALPHA).semantics {
            contentDescription = label
            stateDescription?.let { this.stateDescription = it }
          },
      color = resolvedContainer,
      contentColor = if (isFilled) Color.White else AiCallColors.Ink,
      shape = CircleShape,
      border =
          if (isFilled) {
            null
          } else {
            BorderStroke(0.5.dp, AiCallColors.ControlOutline)
          },
      shadowElevation = 4.dp,
      enabled = enabled,
      onClick = onClick,
  ) {
    Box(contentAlignment = Alignment.Center) { icon() }
  }
}

@Composable
private fun CallEndedScreen(
    state: AiCallUiState,
    onConfirm: () -> Unit,
) {
  // 사진·이름을 그리지 않게 됐지만 이 조기 반환은 남긴다. 페르소나가 없을 때 아무것도
  // 그리지 않던 기존 동작을 그대로 유지하기 위한 것이다.
  if (state.persona == null) return
  val wasCancelled = state.phase == AiCallPhase.Cancelled

  Column(
      modifier =
          Modifier.fillMaxSize()
              .background(
                  Brush.verticalGradient(
                      colors = listOf(AiCallColors.LavenderTint, Color.White),
                  )
              )
              .testTag("call-gradient-background")
              .padding(horizontal = 30.dp, vertical = 32.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    // 문구는 화면 가운데보다 살짝 위에, 확인 버튼은 아래에 붙인다.
    Spacer(modifier = Modifier.weight(1f))
    Text(
        text =
            if (wasCancelled) {
              "통화가 취소되었어요"
            } else {
              "통화가 종료되었어요"
            },
        color = AiCallColors.Ink,
        fontSize = 25.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(10.dp))
    Text(
        text = aiCallEndedDescription(wasCancelled, state.endedByDurationLimit),
        color = AiCallColors.TextMuted,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.weight(1.2f))
    Button(
        onClick = onConfirm,
        modifier = Modifier.fillMaxWidth().height(58.dp).testTag("confirm-call-ended"),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = AiCallColors.Lavender,
                contentColor = AiCallColors.Ink,
            ),
        shape = RoundedCornerShape(50),
    ) {
      Text(
          text = "확인",
          fontSize = 18.sp,
          fontWeight = FontWeight.Bold,
      )
    }
  }
}

@Composable
private fun CallFailedScreen(
    persona: AiPersona?,
    failureReason: AiCallFailureReason,
    onConfirm: () -> Unit,
    onRetry: () -> Unit,
) {
  val title =
      when (failureReason) {
        AiCallFailureReason.Connection -> "통화 실패"
        AiCallFailureReason.EndRequest -> "통화를 종료하지 못했어요"
        AiCallFailureReason.MicrophonePermissionDenied -> "마이크 권한이 필요해요"
        AiCallFailureReason.MicrophonePermissionBlocked -> "마이크 권한이 꺼져 있어요"
      }
  val message =
      when (failureReason) {
        AiCallFailureReason.Connection -> "인터넷 연결을 확인한 뒤 다시 시도해 주세요"
        AiCallFailureReason.EndRequest -> "종료 요청을 다시 시도해 주세요"
        AiCallFailureReason.MicrophonePermissionDenied ->
            "AI 통화를 시작하려면 마이크 사용을 허용해 주세요"
        AiCallFailureReason.MicrophonePermissionBlocked ->
            "휴대폰 설정에서 마이크 권한을 허용해 주세요"
      }
  val primaryActionLabel =
      when (failureReason) {
        AiCallFailureReason.Connection,
        AiCallFailureReason.EndRequest,
        -> "다시 시도"

        AiCallFailureReason.MicrophonePermissionDenied -> "권한 다시 요청"
        AiCallFailureReason.MicrophonePermissionBlocked -> "설정 열기"
      }
  val canSelectAnotherPersona = failureReason != AiCallFailureReason.EndRequest

  Column(
      modifier =
          Modifier.fillMaxSize()
              // 통화 중·종료 화면과 같은 배경. 어두운 배경만 남기면 상태바를 밝은 화면에
              // 맞춰 dark-content로 바꾼 탓에 이 화면에서 시계·배터리가 보이지 않는다.
              .background(
                  Brush.verticalGradient(
                      colors = listOf(AiCallColors.LavenderTint, Color.White),
                  )
              )
              .testTag("call-gradient-background")
              .padding(horizontal = 30.dp, vertical = 32.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    // 문구는 화면 가운데보다 살짝 위에, 동작 버튼은 아래에 붙인다(종료 화면과 같은 구성).
    Spacer(modifier = Modifier.weight(1f))
    Text(
        text = title,
        color = AiCallColors.Ink,
        fontSize = 25.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(10.dp))
    Text(
        text = message,
        color = AiCallColors.TextMuted,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.weight(1.2f))
    val recoveryIcon =
        if (failureReason == AiCallFailureReason.MicrophonePermissionBlocked) {
          Icons.Rounded.Settings
        } else {
          Icons.Rounded.Refresh
        }

    // 종료 요청이 실패한 상황에서는 선택 화면으로 빠져나가는 길을 그대로 막아 둔다. 그때는
    // 유일하게 남은 복구 동작을 큰 버튼으로 올려 화면이 비어 보이지 않게 한다.
    if (canSelectAnotherPersona) {
      Button(
          onClick = onConfirm,
          modifier = Modifier.fillMaxWidth().height(58.dp).testTag("failed-exit"),
          colors =
              ButtonDefaults.buttonColors(
                  containerColor = AiCallColors.Lavender,
                  contentColor = AiCallColors.Ink,
              ),
          shape = RoundedCornerShape(50),
      ) {
        Text(
            text = "종료",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
        )
      }
      Spacer(modifier = Modifier.height(6.dp))
      Row(
          modifier =
              Modifier.clip(RoundedCornerShape(12.dp))
                  .clickable(onClick = onRetry)
                  .padding(horizontal = 20.dp, vertical = 12.dp)
                  .testTag("failed-primary-action"),
          verticalAlignment = Alignment.CenterVertically,
      ) {
        Icon(
            imageVector = recoveryIcon,
            contentDescription = null,
            tint = AiCallColors.Ink,
            modifier = Modifier.size(20.dp),
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = primaryActionLabel,
            color = AiCallColors.Ink,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
        )
      }
    } else {
      Button(
          onClick = onRetry,
          modifier = Modifier.fillMaxWidth().height(58.dp).testTag("failed-primary-action"),
          colors =
              ButtonDefaults.buttonColors(
                  containerColor = AiCallColors.Lavender,
                  contentColor = AiCallColors.Ink,
              ),
          shape = RoundedCornerShape(50),
      ) {
        Icon(
            imageVector = recoveryIcon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = primaryActionLabel,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
        )
      }
    }
  }
}

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
      is Activity -> this
      is ContextWrapper -> baseContext.findActivity()
      else -> null
    }
