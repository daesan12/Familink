package com.s15p11b104app.aicall

import android.Manifest
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.ApplicationInfo
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.paint
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
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
import com.s15p11b104app.R
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive

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
  var isMuted by rememberSaveable { mutableStateOf(false) }
  var isSpeakerOn by rememberSaveable { mutableStateOf(true) }
  var captionDraft by rememberSaveable { mutableStateOf("") }
  var currentCaption by rememberSaveable { mutableStateOf<String?>(null) }
  var captionHistory by remember { mutableStateOf(emptyList<String>()) }
  var pendingPersonaId by rememberSaveable { mutableStateOf<Long?>(null) }
  var permissionResult by remember { mutableStateOf<Boolean?>(null) }
  var connectionLostSignal by remember { mutableIntStateOf(0) }
  var isEnding by rememberSaveable { mutableStateOf(false) }
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
                    currentCaption = completedCaption
                  }
                  captionDraft = ""
                } else {
                  captionDraft += update.text
                  currentCaption = captionDraft
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

  LaunchedEffect(phase) {
    if (phase == AiCallPhase.InProgress) {
      while (isActive) {
        delay(1_000)
        durationSeconds += 1
      }
    }
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
      failedEndPhase = null
      failureReason = AiCallFailureReason.Connection
      durationSeconds = 0
      captionDraft = ""
      currentCaption = null
      captionHistory = emptyList()
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
    failedEndPhase = null
    failureReason = AiCallFailureReason.Connection
    pendingPersonaId = null
    permissionResult = null
    phase = AiCallPhase.Selecting
    durationSeconds = 0
    captionDraft = ""
    currentCaption = null
    captionHistory = emptyList()
    isMuted = false
    isSpeakerOn = true
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

  val finishCall = {
    if (!isEnding && (phase == AiCallPhase.Connecting || phase == AiCallPhase.InProgress)) {
      finishCallFromPhase(phase)
    }
  }

  BackHandler(enabled = phase != AiCallPhase.Selecting) {
    when (phase) {
      AiCallPhase.Connecting,
      AiCallPhase.InProgress,
      -> finishCall()

      AiCallPhase.Ending -> Unit

      AiCallPhase.Failed ->
          if (isFailedCallSelectionAllowed(failureReason == AiCallFailureReason.EndRequest)) {
            returnToSelection()
          }

      else -> returnToSelection()
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
              currentCaption = currentCaption,
              captionHistory = captionHistory,
          ),
      selectedPersonaId = selectedPersonaId,
      onPersonaSelected = { selectedPersonaId = it },
      onStartCall = {
        if (selectedPersona != null) {
          startCall(selectedPersona.id)
        }
      },
      onPreviewFailure = {
        if (selectedPersona != null) {
          failedEndPhase = null
          failureReason = AiCallFailureReason.Connection
          durationSeconds = 0
          phase = AiCallPhase.Failed
          onCallResult(AiCallResult.Failed.wireValue)
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
      onEndCall = finishCall,
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
    onPreviewFailure: () -> Unit = {},
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
            onPreviewFailure = onPreviewFailure,
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
    onPreviewFailure: () -> Unit,
) {
  val selectedPersona = aiPersonas.firstOrNull { it.id == selectedPersonaId }
  val featuredPersona = selectedPersona ?: aiPersonas.first()
  val context = LocalContext.current
  val applicationInfo = context.applicationInfo
  val isDebuggable = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
  val animationsEnabled = remember(context) { areSystemAnimationsEnabled(context) }

  Column(
      modifier =
          Modifier.fillMaxSize()
              .background(AiCallColors.Background)
              .verticalScroll(rememberScrollState())
              .padding(horizontal = 24.dp, vertical = 18.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(
        text = "오늘은 누구와\n이야기할까요?",
        color = AiCallColors.TextStrong,
        fontSize = 28.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 34.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = "아래 사진을 눌러 대화 상대를 골라보세요",
        color = AiCallColors.TextMuted,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(16.dp))

    FeaturedPersona(
        persona = featuredPersona,
        selected = selectedPersona != null,
        animationsEnabled = animationsEnabled,
    )
    Spacer(modifier = Modifier.height(20.dp))

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
      aiPersonasForSelection.chunked(3).forEach { rowPersonas ->
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
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

    Spacer(modifier = Modifier.height(24.dp))
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
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
          modifier = Modifier.size(104.dp).testTag("start-call-depth"),
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
                    disabledContainerColor = AiCallColors.Disabled,
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
      Spacer(modifier = Modifier.height(4.dp))
      Text(
          text = "통화 시작",
          color =
              if (selectedPersona == null) {
                AiCallColors.TextMuted
              } else {
                AiCallColors.BrandPurplePressed
              },
          fontSize = 20.sp,
          fontWeight = FontWeight.Bold,
      )
      if (isDebuggable && selectedPersona != null) {
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = "연결 실패 화면 확인",
            color = AiCallColors.TextMuted,
            fontSize = 12.sp,
            modifier =
                Modifier.clip(RoundedCornerShape(10.dp))
                    .clickable(
                        role = Role.Button,
                        onClick = onPreviewFailure,
                    )
                    .testTag("preview-connection-failure")
                    .padding(horizontal = 10.dp, vertical = 5.dp),
        )
      }
    }
    Spacer(modifier = Modifier.height(8.dp))
  }
}

@Composable
private fun FeaturedPersona(
    persona: AiPersona,
    selected: Boolean,
    animationsEnabled: Boolean,
) {
  val density = LocalDensity.current
  val floatingProgress =
      if (selected && animationsEnabled) {
        val transition = rememberInfiniteTransition(label = "featured persona float")
        transition
            .animateFloat(
                initialValue = -1f,
                targetValue = 1f,
                animationSpec =
                    infiniteRepeatable(
                        animation = tween(7_200, easing = FastOutSlowInEasing),
                        repeatMode = RepeatMode.Reverse,
                    ),
                label = "featured persona vertical position",
            )
            .value
      } else {
        0f
      }
  val floatingDistance = with(density) { 1.5.dp.toPx() }

  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Box(
        modifier =
            Modifier.size(188.dp)
                .graphicsLayer { translationY = floatingDistance * floatingProgress }
                .testTag("featured-persona-depth"),
        contentAlignment = Alignment.Center,
    ) {
      Box(
          modifier =
              Modifier.size(158.dp)
                  .shadow(
                      elevation = if (selected) 18.dp else 9.dp,
                      shape = CircleShape,
                      ambientColor = Color.Black.copy(alpha = if (selected) 0.16f else 0.10f),
                      spotColor = Color.Black.copy(alpha = if (selected) 0.20f else 0.12f),
                  )
                  .testTag("featured-persona-image")
                  .background(Color.White, CircleShape)
                  .padding(6.dp)
                  .clip(CircleShape),
      ) {
        Image(
            painter = painterResource(persona.imageResource),
            contentDescription = "${persona.displayName} 대표 사진",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )
      }
      if (selected) {
        Box(
            modifier =
                Modifier.align(Alignment.BottomEnd)
                    .offset(x = (-8).dp, y = (-8).dp)
                    .size(50.dp)
                    .shadow(
                        elevation = 8.dp,
                        shape = CircleShape,
                        ambientColor = Color.Black.copy(alpha = 0.12f),
                        spotColor = Color.Black.copy(alpha = 0.16f),
                    )
                    .background(Color.White, CircleShape)
                    .padding(4.dp)
                    .background(AiCallColors.BrandPurple, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
          Icon(
              imageVector = Icons.Rounded.Check,
              contentDescription = null,
              tint = Color.White,
              modifier = Modifier.size(28.dp),
          )
        }
      }
    }
    Spacer(modifier = Modifier.height(6.dp))
    Text(
        text = persona.displayName,
        modifier = Modifier.testTag("selected-persona-name"),
        color = AiCallColors.TextStrong,
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 30.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(8.dp))
    Surface(
        color = AiCallColors.LavenderSurface,
        shape = RoundedCornerShape(50),
    ) {
      Text(
          text = persona.toneTag,
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
        text = persona.introduction,
        modifier = Modifier.fillMaxWidth().testTag("selected-persona-introduction"),
        color = AiCallColors.TextStrong,
        fontSize = 14.sp,
        lineHeight = 21.sp,
        textAlign = TextAlign.Center,
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
            Modifier.size(100.dp)
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
              Modifier.size(82.dp)
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
                            Color(0xFFE7E4EC)
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
  val currentCaption = state.currentCaption ?: "자막을 기다리는 중입니다."
  val previousCaption = state.captionHistory.dropLast(1).lastOrNull()

  Column(
      modifier =
          Modifier.fillMaxSize()
              .background(AiCallColors.CallBackground)
              .paint(
                  painter = painterResource(R.drawable.ai_call_gradient_background),
                  contentScale = ContentScale.Crop,
              )
              .testTag("call-gradient-background")
              .padding(horizontal = 24.dp, vertical = 22.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(
        text =
            if (isConnecting) {
              "통화 연결 중"
            } else if (isEnding) {
              "통화 종료 중"
            } else {
              formatCallDuration(state.durationSeconds)
            },
        color = AiCallColors.OnDarkMuted,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.testTag("call-status"),
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
        text = persona.callName,
        color = AiCallColors.OnDark,
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
    )
    Spacer(modifier = Modifier.height(18.dp))
    Image(
        painter = painterResource(persona.imageResource),
        contentDescription = "${persona.displayName} 사진",
        modifier =
            Modifier.size(132.dp)
                .shadow(
                    elevation = 12.dp,
                    shape = CircleShape,
                    ambientColor = Color.Black.copy(alpha = 0.24f),
                    spotColor = Color.Black.copy(alpha = 0.24f),
                )
                .clip(CircleShape),
        contentScale = ContentScale.Crop,
    )

    Spacer(modifier = Modifier.weight(1f))
    if (!isConnecting && !isEnding) {
      Column(
          modifier =
              Modifier.fillMaxWidth()
                  .semantics { liveRegion = LiveRegionMode.Polite }
                  .testTag("live-caption"),
      ) {
        if (previousCaption != null) {
          Text(
              text = previousCaption,
              color = AiCallColors.OnDarkMuted,
              fontSize = 16.sp,
              lineHeight = 24.sp,
              maxLines = 2,
              overflow = TextOverflow.Ellipsis,
          )
          Spacer(modifier = Modifier.height(10.dp))
        }
        Text(
            text = currentCaption,
            color = AiCallColors.OnDark,
            fontSize = 27.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 38.sp,
        )
      }
    } else {
      Text(
          text = if (isEnding) "통화 종료 중입니다." else "잠시만 기다려 주세요.",
          color = AiCallColors.OnDarkMuted,
          fontSize = 17.sp,
      )
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
          onClick = onToggleSpeaker,
      ) {
        Icon(
            imageVector =
                if (state.isSpeakerOn) {
                  Icons.AutoMirrored.Rounded.VolumeUp
                } else {
                  Icons.AutoMirrored.Rounded.VolumeOff
                },
            contentDescription = null,
            modifier = Modifier.size(30.dp),
        )
      }
      CallControlButton(
          label = "통화 종료",
          containerColor = AiCallColors.CoralRed,
          size = 78.dp,
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

@Composable
private fun CallControlButton(
    label: String,
    onClick: () -> Unit,
    containerColor: Color = Color.White,
    size: androidx.compose.ui.unit.Dp = 64.dp,
    stateDescription: String? = null,
    icon: @Composable () -> Unit,
) {
  Surface(
      modifier =
          Modifier.size(size).semantics {
            contentDescription = label
            stateDescription?.let { this.stateDescription = it }
          },
      color = containerColor,
      contentColor =
          if (containerColor == Color.White) {
            AiCallColors.TextStrong
          } else {
            Color.White
          },
      shape = CircleShape,
      shadowElevation = 5.dp,
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
  val persona = state.persona ?: return
  val wasCancelled = state.phase == AiCallPhase.Cancelled

  Column(
      modifier =
          Modifier.fillMaxSize()
              .background(AiCallColors.EndBackground)
              .paint(
                  painter = painterResource(R.drawable.ai_call_gradient_background),
                  contentScale = ContentScale.Crop,
              )
              .testTag("call-gradient-background")
              .padding(horizontal = 30.dp, vertical = 32.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
  ) {
    Image(
        painter = painterResource(persona.imageResource),
        contentDescription = "${persona.displayName} 사진",
        modifier =
            Modifier.size(138.dp)
                .shadow(
                    elevation = 12.dp,
                    shape = CircleShape,
                    ambientColor = Color.Black.copy(alpha = 0.22f),
                    spotColor = Color.Black.copy(alpha = 0.22f),
                )
                .clip(CircleShape),
        contentScale = ContentScale.Crop,
    )
    Spacer(modifier = Modifier.height(24.dp))
    Text(
        text = persona.callName,
        color = AiCallColors.OnDark,
        fontSize = 21.sp,
        fontWeight = FontWeight.Bold,
    )
    if (!wasCancelled) {
      Spacer(modifier = Modifier.height(7.dp))
      Text(
          text = formatCallDuration(state.durationSeconds),
          color = AiCallColors.OnDarkMuted,
          fontSize = 16.sp,
      )
    }
    Spacer(modifier = Modifier.height(34.dp))
    Text(
        text =
            if (wasCancelled) {
              "통화가 취소되었어요."
            } else {
              "통화가 종료되었어요."
            },
        color = AiCallColors.OnDark,
        fontSize = 25.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(10.dp))
    Text(
        text =
            if (wasCancelled) {
              "준비되면 다시 이야기해 보세요."
            } else {
              "오늘 나눈 이야기는 소중히 기억할게요."
            },
        color = AiCallColors.OnDarkMuted,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(42.dp))
    Button(
        onClick = onConfirm,
        modifier = Modifier.fillMaxWidth().height(58.dp).testTag("confirm-call-ended"),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = Color.White,
                contentColor = AiCallColors.TextStrong,
            ),
        shape = RoundedCornerShape(18.dp),
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
        AiCallFailureReason.Connection -> "통화를 연결하지 못했어요."
        AiCallFailureReason.EndRequest -> "통화를 종료하지 못했어요."
        AiCallFailureReason.MicrophonePermissionDenied -> "마이크 권한이 필요해요."
        AiCallFailureReason.MicrophonePermissionBlocked -> "마이크 권한이 꺼져 있어요."
      }
  val message =
      when (failureReason) {
        AiCallFailureReason.Connection -> "인터넷 연결을 확인한 뒤 다시 시도해 주세요."
        AiCallFailureReason.EndRequest -> "종료 요청을 다시 시도해 주세요."
        AiCallFailureReason.MicrophonePermissionDenied ->
            "AI 통화를 시작하려면 마이크 사용을 허용해 주세요."
        AiCallFailureReason.MicrophonePermissionBlocked ->
            "휴대폰 설정에서 마이크 권한을 허용해 주세요."
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
              .background(AiCallColors.EndBackground)
              .paint(
                  painter = painterResource(R.drawable.ai_call_gradient_background),
                  contentScale = ContentScale.Crop,
              )
              .testTag("call-gradient-background")
              .padding(horizontal = 30.dp, vertical = 32.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
  ) {
    persona?.let {
      Image(
          painter = painterResource(it.imageResource),
          contentDescription = "${it.displayName} 사진",
          modifier = Modifier.size(132.dp).clip(CircleShape),
          contentScale = ContentScale.Crop,
      )
      Spacer(modifier = Modifier.height(28.dp))
    }
    Text(
        text = title,
        color = AiCallColors.OnDark,
        fontSize = 25.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(10.dp))
    Text(
        text = message,
        color = AiCallColors.OnDarkMuted,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        textAlign = TextAlign.Center,
    )
    Spacer(modifier = Modifier.height(38.dp))
    Button(
        onClick = onRetry,
        modifier = Modifier.fillMaxWidth().height(58.dp).testTag("failed-primary-action"),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = AiCallColors.BrandPurple,
                contentColor = Color.White,
            ),
        shape = RoundedCornerShape(18.dp),
    ) {
      Icon(
          imageVector =
              if (failureReason == AiCallFailureReason.MicrophonePermissionBlocked) {
                Icons.Rounded.Settings
              } else {
                Icons.Rounded.Refresh
              },
          contentDescription = null,
      )
      Spacer(modifier = Modifier.width(8.dp))
      Text(
          text = primaryActionLabel,
          fontSize = 18.sp,
          fontWeight = FontWeight.Bold,
      )
    }
    if (canSelectAnotherPersona) {
      Spacer(modifier = Modifier.height(12.dp))
      Text(
          text = "다른 상대 선택",
          color = AiCallColors.OnDark,
          fontSize = 16.sp,
          fontWeight = FontWeight.SemiBold,
          modifier =
              Modifier.clip(RoundedCornerShape(12.dp))
                  .clickable(onClick = onConfirm)
                  .padding(horizontal = 20.dp, vertical = 14.dp),
      )
    }
  }
}

private tailrec fun Context.findActivity(): Activity? =
    when (this) {
      is Activity -> this
      is ContextWrapper -> baseContext.findActivity()
      else -> null
    }
