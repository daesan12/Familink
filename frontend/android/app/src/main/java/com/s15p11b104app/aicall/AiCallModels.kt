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
                    "편안한 존댓말로 천천히 이야기를 이어가요.",
            imageResource = R.drawable.persona_son,
        ),
        AiPersona(
            id = 2,
            displayName = "사랑스러운 딸",
            callName = "딸",
            toneTag = "세심한 말투",
            introduction =
                "세심한 말투로 가족을 살뜰히 챙겨요.\n" +
                    "밝은 맞장구로 기분 좋은 대화를 만들어요.",
            imageResource = R.drawable.persona_daughter,
        ),
        AiPersona(
            id = 3,
            displayName = "비서 도윤",
            callName = "AI 비서 도윤",
            toneTag = "침착한 말투",
            introduction =
                "침착한 말투로 일정과 궁금한 일을 또박또박 정리해요.\n" +
                    "여유로운 재치로 즐거운 대화를 이끌어요.",
            imageResource = R.drawable.persona_assistant_male,
        ),
        AiPersona(
            id = 4,
            displayName = "비서 민정",
            callName = "AI 비서 민정",
            toneTag = "차분한 말투",
            introduction =
                "차분한 말투로 필요한 내용을 쉽고 꼼꼼하게 안내해요.\n" +
                    "부담 없는 유머를 곁들여 편안하게 이야기를 이어가요.",
            imageResource = R.drawable.persona_assistant_female,
        ),
        AiPersona(
            id = 5,
            displayName = "친구 학수",
            callName = "학수",
            toneTag = "유쾌한 말투",
            introduction =
                "오랜 친구처럼 편한 반말과 옅은 경상도 말투로\n" +
                    "구수한 농담과 옛이야기를 건네며 웃음을 더해요.",
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

internal data class AiCallUiState(
    val phase: AiCallPhase,
    val persona: AiPersona?,
    val failureReason: AiCallFailureReason = AiCallFailureReason.Connection,
    val durationSeconds: Int = 0,
    val isMuted: Boolean = false,
    val isSpeakerOn: Boolean = true,
    val captionDraft: String = "",
    val captionHistory: List<String> = emptyList(),
)

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
