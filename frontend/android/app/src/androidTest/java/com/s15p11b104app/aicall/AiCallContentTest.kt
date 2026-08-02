package com.s15p11b104app.aicall

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test

class AiCallContentTest {

  @get:Rule val composeRule = createComposeRule()

  @Test
  fun 페르소나를_선택해야_통화를_시작할_수_있다() {
    var selectedPersonaId by mutableStateOf<Long?>(null)

    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state =
                AiCallUiState(
                    phase = AiCallPhase.Selecting,
                    persona = null,
                ),
            selectedPersonaId = selectedPersonaId,
            onPersonaSelected = { selectedPersonaId = it },
            onStartCall = {},
            onToggleMute = {},
            onToggleSpeaker = {},
            onEndCall = {},
            onConfirm = {},
            onRetry = {},
        )
      }
    }

    composeRule.onNodeWithTag("start-call").assertIsNotEnabled()
    composeRule.onNodeWithTag("persona-4").performClick().assertIsSelected()
    composeRule.onNodeWithTag("start-call").assertIsEnabled()
    composeRule.onNodeWithText("“편하게 말씀해 주세요. 제가 듣고 있어요.”").assertIsDisplayed()
  }

  @Test
  fun 연결_중에는_타이머_자리에_연결_상태를_표시한다() {
    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state =
                AiCallUiState(
                    phase = AiCallPhase.Connecting,
                    persona = aiPersonas.first(),
                ),
            selectedPersonaId = 1,
            onPersonaSelected = {},
            onStartCall = {},
            onToggleMute = {},
            onToggleSpeaker = {},
            onEndCall = {},
            onConfirm = {},
            onRetry = {},
        )
      }
    }

    composeRule.onNodeWithTag("call-status").assertIsDisplayed()
    composeRule.onNodeWithText("통화 연결 중").assertIsDisplayed()
    composeRule.onNodeWithText("잠시만 기다려 주세요.").assertIsDisplayed()
  }

  @Test
  fun 통화_중에는_AI_자막과_통화_제어를_표시한다() {
    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state =
                AiCallUiState(
                    phase = AiCallPhase.InProgress,
                    persona = aiPersonas[3],
                    durationSeconds = 7,
                ),
            selectedPersonaId = 4,
            onPersonaSelected = {},
            onStartCall = {},
            onToggleMute = {},
            onToggleSpeaker = {},
            onEndCall = {},
            onConfirm = {},
            onRetry = {},
        )
      }
    }

    composeRule.onNodeWithText("00:07").assertIsDisplayed()
    composeRule.onNodeWithTag("live-caption").assertIsDisplayed()
    composeRule.onNodeWithText("안녕하세요, 어르신. 오늘은 어떤 하루를 보내셨어요?").assertIsDisplayed()
    composeRule.onNodeWithContentDescription("통화 종료").assertIsDisplayed()
  }

  @Test
  fun 종료_화면은_핵심_정보와_확인_동작만_강조한다() {
    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state =
                AiCallUiState(
                    phase = AiCallPhase.Completed,
                    persona = aiPersonas[3],
                    durationSeconds = 125,
                ),
            selectedPersonaId = 4,
            onPersonaSelected = {},
            onStartCall = {},
            onToggleMute = {},
            onToggleSpeaker = {},
            onEndCall = {},
            onConfirm = {},
            onRetry = {},
        )
      }
    }

    composeRule.onNodeWithText("통화가 종료되었어요.").assertIsDisplayed()
    composeRule.onNodeWithText("02:05").assertIsDisplayed()
    composeRule.onNodeWithTag("confirm-call-ended").assertIsDisplayed()
  }

  @Test
  fun 디버그_흐름에서_연결_실패와_재시도_화면을_확인한다() {
    composeRule.setContent {
      AiCallTheme {
        AiCallRoute(
            apiBaseUrl = null,
            bridgeContext = AiCallBridgeContext("test-access-token", "group-1"),
            onCallResult = {},
            onFullscreenChange = {},
        )
      }
    }

    composeRule.onNodeWithTag("persona-4").performClick()
    composeRule.onNodeWithTag("preview-connection-failure").performClick()
    composeRule.onNodeWithText("통화를 연결하지 못했어요.").assertIsDisplayed()
    composeRule.onNodeWithText("인터넷 연결을 확인한 뒤 다시 시도해 주세요.").assertIsDisplayed()

    composeRule.onNodeWithText("다시 시도").performClick()
    composeRule.onNodeWithText("통화 연결 중").assertIsDisplayed()
  }
}
