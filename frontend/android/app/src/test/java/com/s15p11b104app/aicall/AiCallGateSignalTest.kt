package com.s15p11b104app.aicall

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AiCallGateSignalTest {

  @Test
  fun `playback start closes the gate`() {
    assertEquals(
        AiCallGateSignal.PlaybackStarted,
        aiCallGateSignalOf("output_audio_buffer.started"),
    )
  }

  @Test
  fun `a drained output buffer opens the gate`() {
    assertEquals(
        AiCallGateSignal.PlaybackEnded,
        aiCallGateSignalOf("output_audio_buffer.stopped"),
    )
  }

  @Test
  fun `a cleared output buffer also opens the gate`() {
    // 인터럽션이 레이스로 통과하면 stopped 대신 cleared만 온다. 이것을 해제로 받지
    // 않으면 워치독 시간까지 마이크가 닫힌 채로 남는다.
    assertEquals(
        AiCallGateSignal.PlaybackEnded,
        aiCallGateSignalOf("output_audio_buffer.cleared"),
    )
  }

  @Test
  fun `generation completion is not a playback boundary`() {
    // 생성 완료는 재생 완료보다 수 초 이르다. 이것으로 게이트를 열면 정작 끼어들기가
    // 발생하는 구간에서 마이크가 열려 이번 수정이 무효가 된다.
    assertNull(aiCallGateSignalOf("response.done"))
    assertNull(aiCallGateSignalOf("response.output_audio_transcript.done"))
    assertNull(aiCallGateSignalOf("response.output_item.done"))
  }

  @Test
  fun `user speech detection does not move the gate`() {
    assertNull(aiCallGateSignalOf("input_audio_buffer.speech_started"))
    assertNull(aiCallGateSignalOf("input_audio_buffer.speech_stopped"))
  }

  @Test
  fun `an unrelated event is not a signal`() {
    assertNull(aiCallGateSignalOf(""))
    assertNull(aiCallGateSignalOf("output_audio_buffer"))
    assertNull(aiCallGateSignalOf("session.updated"))
    assertNull(aiCallGateSignalOf("conversation.item.truncated"))
  }
}
