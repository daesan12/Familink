package com.s15p11b104app.aicall

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
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
    composeRule.onNodeWithTag("featured-persona-depth").assertIsDisplayed()
    composeRule.onNodeWithTag("start-call-depth").assertIsDisplayed()
    composeRule.onNodeWithTag("persona-4").performClick().assertIsSelected()
    composeRule.onNodeWithTag("start-call").assertIsEnabled()
    composeRule.onNodeWithText("차분한 말투").assertIsDisplayed()
    composeRule
        .onNodeWithText(
            "차분한 말투로 필요한 내용을 쉽고 꼼꼼하게 안내해요.\n" +
                "부담 없는 유머를 곁들여 편안하게 이야기를 이어가요."
        )
        .assertIsDisplayed()
  }

  @Test
  fun 페르소나를_바꿀_때마다_이름과_태그와_소개글이_함께_바뀐다() {
    var selectedPersonaId by mutableStateOf<Long?>(1)

    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state = AiCallUiState(phase = AiCallPhase.Selecting, persona = null),
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

    aiPersonas.forEach { persona ->
      composeRule.onNodeWithTag("persona-${persona.id}").performClick().assertIsSelected()
      composeRule
          .onNodeWithTag("persona-depth-${persona.id}")
          .assertIsDisplayed()
      composeRule
          .onNodeWithTag("persona-selected-check-${persona.id}")
          .assertIsDisplayed()
      composeRule.onNodeWithTag("selected-persona-name").assertTextEquals(persona.displayName)
      composeRule.onNodeWithTag("selected-persona-tag").assertTextEquals(persona.toneTag)
      composeRule
          .onNodeWithTag("selected-persona-introduction")
          .assertTextEquals(persona.introduction)
    }
  }

  @Test
  fun depth_motion_does_not_reflow_surrounding_layout() {
    composeRule.mainClock.autoAdvance = false
    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state = AiCallUiState(phase = AiCallPhase.Selecting, persona = null),
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

    val personaNameBounds =
        composeRule.onNodeWithTag("selected-persona-name").fetchSemanticsNode().boundsInRoot
    val callButtonBounds = composeRule.onNodeWithTag("start-call").fetchSemanticsNode().boundsInRoot

    composeRule.mainClock.advanceTimeBy(4_200)

    assertEquals(
        personaNameBounds,
        composeRule.onNodeWithTag("selected-persona-name").fetchSemanticsNode().boundsInRoot,
    )
    assertEquals(
        callButtonBounds,
        composeRule.onNodeWithTag("start-call").fetchSemanticsNode().boundsInRoot,
    )
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
                    currentCaption = "안녕하세요, 어르신. 오늘은 어떤 하루를 보내셨어요?",
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
    composeRule.onNodeWithTag("call-gradient-background").assertIsDisplayed()
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
    composeRule.onNodeWithTag("call-gradient-background").assertIsDisplayed()
    composeRule.onNodeWithText("02:05").assertIsDisplayed()
    composeRule.onNodeWithTag("confirm-call-ended").assertIsDisplayed()
  }

  @Test
  fun 실패_원인에_맞는_안내와_복구_동작을_표시한다() {
    var state by
        mutableStateOf(
            AiCallUiState(
                phase = AiCallPhase.Failed,
                persona = aiPersonas.first(),
            )
        )
    var primaryActionCount = 0

    composeRule.setContent {
      AiCallTheme {
        AiCallContent(
            state = state,
            selectedPersonaId = 1,
            onPersonaSelected = {},
            onStartCall = {},
            onToggleMute = {},
            onToggleSpeaker = {},
            onEndCall = {},
            onConfirm = {},
            onRetry = { primaryActionCount += 1 },
        )
      }
    }

    composeRule.onNodeWithTag("call-gradient-background").assertIsDisplayed()
    composeRule.onNodeWithText("통화를 연결하지 못했어요.").assertIsDisplayed()
    composeRule.onNodeWithText("인터넷 연결을 확인한 뒤 다시 시도해 주세요.").assertIsDisplayed()
    composeRule.onNodeWithText("다시 시도").assertIsDisplayed()

    composeRule.runOnIdle {
      state = state.copy(failureReason = AiCallFailureReason.EndRequest)
    }
    composeRule.onNodeWithText("통화를 종료하지 못했어요.").assertIsDisplayed()
    composeRule.onNodeWithText("다른 상대 선택").assertDoesNotExist()

    composeRule.runOnIdle {
      state = state.copy(failureReason = AiCallFailureReason.MicrophonePermissionDenied)
    }
    composeRule.onNodeWithText("마이크 권한이 필요해요.").assertIsDisplayed()
    composeRule.onNodeWithText("권한 다시 요청").performClick()

    composeRule.runOnIdle {
      state = state.copy(failureReason = AiCallFailureReason.MicrophonePermissionBlocked)
    }
    composeRule.onNodeWithText("마이크 권한이 꺼져 있어요.").assertIsDisplayed()
    composeRule.onNodeWithText("휴대폰 설정에서 마이크 권한을 허용해 주세요.").assertIsDisplayed()
    composeRule.onNodeWithText("설정 열기").performClick()

    composeRule.runOnIdle { assertEquals(2, primaryActionCount) }
  }
}
