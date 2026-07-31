package com.s15p11b104app.aicall

import androidx.annotation.DrawableRes
import com.s15p11b104app.R

internal enum class AiCallPhase {
  Selecting,
  Connecting,
  InProgress,
  Completed,
  Cancelled,
  Failed,
}

internal data class AiCallBridgeContext(
    val accessToken: String?,
    val groupId: String?,
)

internal enum class AiCallResult(val wireValue: String) {
  Completed("COMPLETED"),
  Cancelled("CANCELLED"),
  Failed("FAILED"),
}

internal data class AiPersona(
    val id: Long,
    val displayName: String,
    val callName: String,
    val exampleUtterance: String,
    @DrawableRes val imageResource: Int,
)

internal val aiPersonas =
    listOf(
        AiPersona(
            id = 1,
            displayName = "사랑스러운 아들",
            callName = "아들",
            exampleUtterance = "엄마, 오늘 하루는 어떠셨어요?",
            imageResource = R.drawable.persona_son,
        ),
        AiPersona(
            id = 2,
            displayName = "사랑스러운 딸",
            callName = "딸",
            exampleUtterance = "엄마, 식사는 맛있게 하셨어요?",
            imageResource = R.drawable.persona_daughter,
        ),
        AiPersona(
            id = 3,
            displayName = "남자 비서",
            callName = "AI 비서 도윤",
            exampleUtterance = "오늘 일정을 차근차근 알려드릴게요.",
            imageResource = R.drawable.persona_assistant_male,
        ),
        AiPersona(
            id = 4,
            displayName = "여자 비서",
            callName = "AI 비서 민정",
            exampleUtterance = "편하게 말씀해 주세요. 제가 듣고 있어요.",
            imageResource = R.drawable.persona_assistant_female,
        ),
        AiPersona(
            id = 5,
            displayName = "친구 학수",
            callName = "학수",
            exampleUtterance = "친구야, 오늘은 뭐 하면서 지냈어?",
            imageResource = R.drawable.persona_friend_haksu,
        ),
        AiPersona(
            id = 6,
            displayName = "친구 복희",
            callName = "복희",
            exampleUtterance = "우리 오랜만에 재미있는 이야기 나눠요.",
            imageResource = R.drawable.persona_friend_bokhee,
        ),
    )

internal data class AiCallUiState(
    val phase: AiCallPhase,
    val persona: AiPersona?,
    val durationSeconds: Int = 0,
    val isMuted: Boolean = false,
    val isSpeakerOn: Boolean = true,
    val captionIndex: Int = 0,
)

internal fun formatCallDuration(durationSeconds: Int): String {
  val minutes = durationSeconds / 60
  val seconds = durationSeconds % 60
  return "%02d:%02d".format(minutes, seconds)
}
