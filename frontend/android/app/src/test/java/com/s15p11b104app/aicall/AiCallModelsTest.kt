package com.s15p11b104app.aicall

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Test

class AiCallModelsTest {

  @Test
  fun `통화 시간을 분과 초로 표시한다`() {
    assertEquals("00:00", formatCallDuration(0))
    assertEquals("01:05", formatCallDuration(65))
    assertEquals("59:59", formatCallDuration(3_599))
  }

  @Test
  fun `통화 최대 시간은 10분이다`() {
    assertEquals(10 * 60, AI_CALL_MAX_DURATION_SECONDS)
  }

  @Test
  fun `상한에 도달한 순간부터 통화를 끝낼 대상으로 판정한다`() {
    assertEquals(false, isAiCallDurationLimitReached(AI_CALL_MAX_DURATION_SECONDS - 1))
    assertEquals(true, isAiCallDurationLimitReached(AI_CALL_MAX_DURATION_SECONDS))
    // 1초 카운터가 한 틱을 건너뛰어도 상한을 지나치지 않는다.
    assertEquals(true, isAiCallDurationLimitReached(AI_CALL_MAX_DURATION_SECONDS + 1))
  }

  @Test
  fun `시간 만료로 끝난 통화는 사용자 종료와 다른 안내 문구를 쓴다`() {
    val userEnded = aiCallEndedDescription(wasCancelled = false, endedByDurationLimit = false)
    val durationLimited = aiCallEndedDescription(wasCancelled = false, endedByDurationLimit = true)
    val cancelled = aiCallEndedDescription(wasCancelled = true, endedByDurationLimit = false)

    assertEquals("오늘 나눈 이야기는 소중히 기억할게요.", userEnded)
    assertEquals("통화 가능한 시간이 다 되어 마무리했어요.", durationLimited)
    assertEquals("준비되면 다시 이야기해 보세요.", cancelled)
  }

  @Test
  fun `연결 전에 취소된 통화는 시간 만료 안내를 쓰지 않는다`() {
    assertEquals(
        "준비되면 다시 이야기해 보세요.",
        aiCallEndedDescription(wasCancelled = true, endedByDurationLimit = true),
    )
  }

  @Test
  fun `페르소나 선택 화면은 관계별 세로 짝이 맞는 순서를 사용한다`() {
    assertEquals(
        listOf("듬직한 아들", "비서 민정", "친구 복희", "사랑스러운 딸", "비서 도윤", "친구 학수"),
        aiPersonasForSelection.map(AiPersona::displayName),
    )
  }

  @Test
  fun `각 페르소나는 서로 다른 말투 태그와 소개글을 가진다`() {
    assertEquals(6, aiPersonas.map(AiPersona::toneTag).distinct().size)
    assertEquals(6, aiPersonas.map(AiPersona::introduction).distinct().size)
  }

  @Test
  fun `종료 서버 응답 전에는 종료 중 상태를 유지한다`() = runBlocking {
    val serverResponse = CompletableDeferred<Unit>()
    var phase = AiCallPhase.Ending

    val endJob =
        launch {
          awaitAiCallEndConfirmation(
              initialPhase = AiCallPhase.InProgress,
              requestEnd = { serverResponse.await() },
              onConfirmed = { result -> phase = result.terminalPhase },
          )
        }
    yield()

    assertEquals(AiCallPhase.Ending, phase)
    serverResponse.complete(Unit)
    endJob.join()
    assertEquals(AiCallPhase.Completed, phase)
  }

  @Test
  fun `종료 실패는 원래 활성 상태로 같은 Runtime 종료를 재시도한다`() = runBlocking {
    val endResponses =
        ArrayDeque(
            listOf(
                Result.failure<Unit>(IllegalStateException("temporary failure")),
                Result.success(Unit),
            )
        )
    var requestCount = 0
    var phase = AiCallPhase.InProgress
    var failedEndPhase: AiCallPhase? = null
    val results = mutableListOf<AiCallResult>()

    suspend fun attemptEnd(initialPhase: AiCallPhase) {
      phase = AiCallPhase.Ending
      try {
        val result =
            awaitAiCallEndConfirmation(
                initialPhase = initialPhase,
                requestEnd = {
                  requestCount += 1
                  endResponses.removeFirst().getOrThrow()
                },
                onConfirmed = { confirmed -> phase = confirmed.terminalPhase },
            )
        failedEndPhase = null
        results += result
      } catch (_: Throwable) {
        failedEndPhase = initialPhase
        phase = AiCallPhase.Failed
        results += AiCallResult.Failed
      }
    }

    attemptEnd(phase)
    assertEquals(AiCallPhase.Failed, phase)
    val retryPhase = failedEndPhase ?: error("the failed end phase must be retained")
    attemptEnd(retryPhase)

    assertEquals(2, requestCount)
    assertEquals(listOf(AiCallResult.Failed, AiCallResult.Completed), results)
    assertEquals(AiCallPhase.Completed, phase)
    assertEquals(null, failedEndPhase)
  }

  @Test
  fun `종료 재시도가 필요한 실패 화면은 선택을 막고 일반 실패는 선택을 허용한다`() {
    assertEquals(false, isFailedCallSelectionAllowed(endRetryRequired = true))
    assertEquals(true, isFailedCallSelectionAllowed(endRetryRequired = false))
  }

  @Test
  fun `통화 화면에서는 시스템 뒤로 가기를 무시한다`() {
    val callPhases = listOf(AiCallPhase.Connecting, AiCallPhase.InProgress, AiCallPhase.Ending)

    assertEquals(
        callPhases.map { AiCallBackAction.Ignore },
        callPhases.map { aiCallBackAction(it, endRetryRequired = false) },
    )
  }

  @Test
  fun `종료 결과 화면에서는 시스템 뒤로 가기로 선택 화면에 돌아간다`() {
    val resultPhases = listOf(AiCallPhase.Completed, AiCallPhase.Cancelled, AiCallPhase.Failed)

    assertEquals(
        resultPhases.map { AiCallBackAction.ReturnToSelection },
        resultPhases.map { aiCallBackAction(it, endRetryRequired = false) },
    )
  }

  @Test
  fun `종료 재시도가 필요한 실패 화면은 시스템 뒤로 가기를 무시한다`() {
    assertEquals(
        AiCallBackAction.Ignore,
        aiCallBackAction(AiCallPhase.Failed, endRetryRequired = true),
    )
  }
}
