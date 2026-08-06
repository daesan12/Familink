package com.s15p11b104app.aicall

import android.os.Handler
import android.os.Looper
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AiCallMicrophoneGateControllerTest {

  private val applied = CopyOnWriteArrayList<Boolean>()

  @Test
  fun 기본_해제_지연은_200밀리초_최대_차단은_15초다() {
    assertEquals(200L, AiCallMicrophoneGateController.TAIL_RELEASE_DELAY_MILLIS)
    assertEquals(15_000L, AiCallMicrophoneGateController.MAX_GATE_DURATION_MILLIS)
  }

  @Test
  fun AI_발화가_시작되면_마이크를_끈다() {
    val controller = createController()

    controller.onPlaybackStarted()

    assertApplied(listOf(false))
    controller.close()
  }

  @Test
  fun 발화가_끝나면_해제_지연_뒤에_마이크를_켠다() {
    // 해제 지연을 넉넉히 두어, 아래 "아직 닫혀 있다" 단정이 스케줄링 지연이나 GC 일시정지로
    // 흔들리지 않게 한다. 지연이 짧으면 이 부정 단정만 간헐적으로 실패한다.
    val controller = createController(tailReleaseDelayMillis = 1_500L)

    controller.onPlaybackStarted()
    assertApplied(listOf(false))

    controller.onPlaybackEnded()
    // 지터 버퍼에 남은 오디오가 재생되는 동안에는 아직 닫힌 상태여야 한다.
    assertEquals(listOf(false), applied.toList())

    assertApplied(listOf(false, true), timeoutMillis = 5_000L)
    controller.close()
  }

  @Test
  fun 사용자_음소거는_발화가_끝나도_유지된다() {
    val controller = createController()

    controller.setUserMicrophoneEnabled(false)
    assertApplied(listOf(false))

    controller.onPlaybackStarted()
    controller.onPlaybackEnded()

    assertStaysApplied(listOf(false))
    controller.close()
  }

  @Test
  fun 발화_중_음소거_해제는_발화가_끝난_뒤_반영된다() {
    val controller = createController()

    controller.setUserMicrophoneEnabled(false)
    assertApplied(listOf(false))

    controller.onPlaybackStarted()
    controller.setUserMicrophoneEnabled(true)
    // 발화 중에는 사용자가 음소거를 해제해도 전송이 재개되지 않는다.
    assertStaysApplied(listOf(false))

    controller.onPlaybackEnded()

    assertApplied(listOf(false, true))
    controller.close()
  }

  @Test
  fun 재생_종료_신호가_없으면_최대_차단_시간_뒤에_마이크를_켠다() {
    val controller = createController(maxGateDurationMillis = 200L)

    controller.onPlaybackStarted()

    assertApplied(listOf(false, true))
    controller.close()
  }

  @Test
  fun 연결이_끊기면_해제_지연_없이_즉시_마이크를_켠다() {
    // 해제 지연을 길게 두어, 켜짐이 지연 경로가 아니라 단절 경로로 일어났음을 보장한다.
    val controller = createController(tailReleaseDelayMillis = 5_000L)

    controller.onPlaybackStarted()
    assertApplied(listOf(false))

    controller.onConnectionInterrupted()

    assertApplied(listOf(false, true), timeoutMillis = 500L)
    controller.close()
  }

  @Test
  fun 연속된_재생_시작은_한_번만_적용한다() {
    val controller = createController()

    controller.onPlaybackStarted()
    controller.onPlaybackStarted()
    controller.onPlaybackStarted()

    assertStaysApplied(listOf(false))
    controller.close()
  }

  @Test
  fun 닫힌_컨트롤러는_지연된_해제를_적용하지_않는다() {
    val controller = createController(tailReleaseDelayMillis = 150L)

    controller.onPlaybackStarted()
    assertApplied(listOf(false))

    controller.onPlaybackEnded()
    controller.close()

    assertStaysApplied(listOf(false), holdMillis = 400L)
  }

  private fun createController(
      tailReleaseDelayMillis: Long = 80L,
      maxGateDurationMillis: Long = 5_000L,
  ): AiCallMicrophoneGateController =
      AiCallMicrophoneGateController(
          handler = Handler(Looper.getMainLooper()),
          tailReleaseDelayMillis = tailReleaseDelayMillis,
          maxGateDurationMillis = maxGateDurationMillis,
          applyMicrophoneEnabled = { applied.add(it) },
      )

  /** 적용 이력이 [expected]가 될 때까지 기다린다. */
  private fun assertApplied(expected: List<Boolean>, timeoutMillis: Long = 2_000L) {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis)
    while (System.nanoTime() < deadline) {
      if (applied.toList() == expected) {
        return
      }
      Thread.sleep(10L)
    }
    assertEquals(expected, applied.toList())
  }

  /** [holdMillis] 동안 적용 이력이 [expected]에서 더 변하지 않음을 확인한다. */
  private fun assertStaysApplied(expected: List<Boolean>, holdMillis: Long = 300L) {
    assertApplied(expected)
    Thread.sleep(holdMillis)
    assertTrue(
        "적용 이력이 예상과 달라졌다: ${applied.toList()}",
        applied.toList() == expected,
    )
  }
}
