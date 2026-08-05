package com.s15p11b104app.aicall

import org.junit.Assert.assertEquals
import org.junit.Test

class AiCallCaptionLinesTest {

  @Test
  fun `no caption yields no lines`() {
    assertEquals(emptyList<String>(), captionState().captionLines)
  }

  @Test
  fun `an in-progress first utterance is the only line`() {
    assertEquals(listOf("안녕"), captionState(draft = "안녕").captionLines)
  }

  @Test
  fun `a completed utterance is the last line once the draft is cleared`() {
    assertEquals(
        listOf("안녕하세요, 어르신."),
        captionState(history = listOf("안녕하세요, 어르신.")).captionLines,
    )
  }

  @Test
  fun `the previous utterance stays visible while the next one is being spoken`() {
    val state = captionState(history = listOf("안녕하세요, 어르신."), draft = "오늘은")

    assertEquals(listOf("안녕하세요, 어르신.", "오늘은"), state.captionLines)
  }

  @Test
  fun `an in-progress utterance is appended after every retained utterance`() {
    val state =
        captionState(
            history = listOf("첫 번째 문장.", "두 번째 문장.", "세 번째 문장."),
            draft = "네 번째",
        )

    assertEquals(
        listOf("첫 번째 문장.", "두 번째 문장.", "세 번째 문장.", "네 번째"),
        state.captionLines,
    )
  }

  @Test
  fun `a blank draft does not add an empty line`() {
    assertEquals(
        listOf("안녕하세요, 어르신."),
        captionState(history = listOf("안녕하세요, 어르신."), draft = "   ").captionLines,
    )
  }

  private fun captionState(
      history: List<String> = emptyList(),
      draft: String = "",
  ): AiCallUiState =
      AiCallUiState(
          phase = AiCallPhase.InProgress,
          persona = aiPersonas.first(),
          captionDraft = draft,
          captionHistory = history,
      )
}
