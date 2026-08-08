package com.s15p11b104app.aicall

import androidx.annotation.DrawableRes
import com.s15p11b104app.R

internal enum class AiCallPhase {
  Selecting,
  Connecting,
  InProgress,
  Ending,
  Completed,
  Cancelled,
  Failed,
}

internal enum class AiCallFailureReason {
  Connection,
  EndRequest,
  MicrophonePermissionDenied,
  MicrophonePermissionBlocked,
}

internal enum class AiCallResult(
    val wireValue: String,
    val terminalPhase: AiCallPhase,
) {
  Completed("COMPLETED", AiCallPhase.Completed),
  Cancelled("CANCELLED", AiCallPhase.Cancelled),
  Failed("FAILED", AiCallPhase.Failed),
}

internal suspend fun awaitAiCallEndConfirmation(
    initialPhase: AiCallPhase,
    requestEnd: suspend () -> Unit,
    onConfirmed: (AiCallResult) -> Unit,
): AiCallResult {
  val result =
      when (initialPhase) {
        AiCallPhase.Connecting -> AiCallResult.Cancelled
        AiCallPhase.InProgress -> AiCallResult.Completed
        else -> error("An AI call can only end from an active phase.")
      }
  requestEnd()
  onConfirmed(result)
  return result
}

internal fun isFailedCallSelectionAllowed(endRetryRequired: Boolean): Boolean = !endRetryRequired

/** 시스템 뒤로 가기를 눌렀을 때 AI 전화 화면이 할 일. */
internal enum class AiCallBackAction {
  /** 뒤로 가기를 소비만 하고 현재 화면을 유지한다. */
  Ignore,
  /** 페르소나 선택 화면으로 돌아간다. */
  ReturnToSelection,
}

/**
 * 연결 중·통화 중·종료 중에는 뒤로 가기를 소비만 한다. 실수로 한 번 누른 것으로 통화가 끊기지 않도록
 * 사용자 조작으로 통화를 끝내는 수단은 화면의 통화 종료 버튼뿐이다.
 * [AI_CALL_MAX_DURATION_SECONDS] 상한 도달은 사용자 조작이 아닌 자동 마감이라 이 규칙과 무관하다.
 * [AiCallPhase.Selecting]은 뒤로 가기를 앱 셸에 넘기므로 여기까지 오지 않지만, 단계가 늘어날 때
 * 누락을 컴파일러가 잡도록 분기를 모두 적는다.
 */
internal fun aiCallBackAction(
    phase: AiCallPhase,
    endRetryRequired: Boolean,
): AiCallBackAction =
    when (phase) {
      AiCallPhase.Connecting,
      AiCallPhase.InProgress,
      AiCallPhase.Ending,
      -> AiCallBackAction.Ignore

      AiCallPhase.Failed ->
          if (isFailedCallSelectionAllowed(endRetryRequired)) AiCallBackAction.ReturnToSelection
          else AiCallBackAction.Ignore

      AiCallPhase.Selecting,
      AiCallPhase.Completed,
      AiCallPhase.Cancelled,
      -> AiCallBackAction.ReturnToSelection
    }

internal data class AiPersona(
    val id: Long,
    val displayName: String,
    val callName: String,
    val toneTag: String,
    val introduction: String,
    @DrawableRes val imageResource: Int,
)

internal val aiPersonas =
    listOf(
        AiPersona(
            id = 1,
            displayName = "듬직한 아들",
            callName = "아들",
            toneTag = "다정한 말투",
            introduction =
                "다정한 말투로 안부를 챙기고\n" +
                    "편안한 존댓말로 천천히 이야기를 이어가요",
            imageResource = R.drawable.persona_son,
        ),
        AiPersona(
            id = 2,
            displayName = "사랑스러운 딸",
            callName = "딸",
            toneTag = "세심한 말투",
            introduction =
                "세심한 말투로 가족을 살뜰히 챙겨요.\n" +
                    "밝은 맞장구로 기분 좋은 대화를 만들어요",
            imageResource = R.drawable.persona_daughter,
        ),
        AiPersona(
            id = 3,
            displayName = "비서 도윤",
            callName = "AI 비서 도윤",
            toneTag = "침착한 말투",
            introduction =
                "침착한 말투로 일정과 궁금한 일을 또박또박 정리해요.\n" +
                    "여유로운 재치로 즐거운 대화를 이끌어요",
            imageResource = R.drawable.persona_assistant_male,
        ),
        AiPersona(
            id = 4,
            displayName = "비서 민정",
            callName = "AI 비서 민정",
            toneTag = "차분한 말투",
            introduction =
                "차분한 말투로 필요한 내용을 쉽고 꼼꼼하게 안내해요.\n" +
                    "부담 없는 유머를 곁들여 편안하게 이야기를 이어가요",
            imageResource = R.drawable.persona_assistant_female,
        ),
        AiPersona(
            id = 5,
            displayName = "친구 학수",
            callName = "학수",
            toneTag = "유쾌한 말투",
            introduction =
                "오랜 친구처럼 편한 반말과 옅은 경상도 말투로\n" +
                    "구수한 농담과 옛이야기를 건네며 웃음을 더해요",
            imageResource = R.drawable.persona_friend_haksu,
        ),
        AiPersona(
            id = 6,
            displayName = "친구 복희",
            callName = "복희",
            toneTag = "정겨운 말투",
            introduction =
                "오랜 친구처럼 정겨운 반말과 옅은 전라도 말투로\n" +
                    "따뜻한 수다를 건네며 활기를 더해요",
            imageResource = R.drawable.persona_friend_bokhee,
        ),
    )

private val AI_PERSONA_SELECTION_ORDER = listOf(1L, 4L, 6L, 2L, 3L, 5L)

internal val aiPersonasForSelection =
    AI_PERSONA_SELECTION_ORDER.map { personaId ->
      requireNotNull(aiPersonas.firstOrNull { it.id == personaId })
    }

/** 통화를 시작할 때의 마이크 상태. 켜진 상태로 시작한다. */
internal const val AI_CALL_DEFAULT_IS_MUTED = false

/**
 * 통화를 시작할 때의 스피커 상태. 일반 전화와 같이 수화기로 시작하므로 꺼짐이다.
 * `AiCallWebRtcSession.configureAudioRoute()`의 초기 라우팅과 반드시 같아야 한다.
 */
internal const val AI_CALL_DEFAULT_IS_SPEAKER_ON = false

/**
 * 한 통화가 이어질 수 있는 최대 시간. 사용자가 말하지 않아도 통화는 스스로 끝나지 않으므로, 상한이
 * 없으면 화면을 켜 둔 채 방치된 통화가 Realtime 비용을 무한히 누적한다.
 */
internal const val AI_CALL_MAX_DURATION_SECONDS = 600

internal fun isAiCallDurationLimitReached(durationSeconds: Int): Boolean =
    durationSeconds >= AI_CALL_MAX_DURATION_SECONDS

internal data class AiCallUiState(
    val phase: AiCallPhase,
    val persona: AiPersona?,
    val failureReason: AiCallFailureReason = AiCallFailureReason.Connection,
    val durationSeconds: Int = 0,
    val isMuted: Boolean = AI_CALL_DEFAULT_IS_MUTED,
    val isSpeakerOn: Boolean = AI_CALL_DEFAULT_IS_SPEAKER_ON,
    val captionDraft: String = "",
    val captionHistory: List<String> = emptyList(),
    val endedByDurationLimit: Boolean = false,
)

/**
 * 종료 결과 화면의 안내 문구. 시간이 다 되어 끝난 통화를 고장으로 오해하지 않도록 사용자 종료와 다른
 * 문구를 쓴다. 취소는 연결 전에 끝난 통화이므로 시간 만료와 겹치지 않는다.
 */
internal fun aiCallEndedDescription(
    wasCancelled: Boolean,
    endedByDurationLimit: Boolean,
): String =
    when {
      wasCancelled -> "준비되면 다시 이야기해 보세요"
      endedByDurationLimit -> "통화 가능한 시간이 다 되어 마무리했어요"
      else -> "오늘 나눈 이야기는 소중히 기억할게요"
    }

/**
 * 화면에 그릴 자막 줄을 오래된 것부터 최신 순으로 반환한다. 발화 중에는 [AiCallUiState.captionDraft]가
 * 마지막 줄이 되고 발화가 끝나면 방금 확정된 문장이 마지막 줄이 되므로, 확정 여부에 따라 표시 대상을
 * 따로 분기할 필요가 없다.
 */
internal val AiCallUiState.captionLines: List<String>
  get() = captionHistory + listOfNotNull(captionDraft.takeIf { it.isNotBlank() })

internal fun formatCallDuration(durationSeconds: Int): String {
  val minutes = durationSeconds / 60
  val seconds = durationSeconds % 60
  return "%02d:%02d".format(minutes, seconds)
}
