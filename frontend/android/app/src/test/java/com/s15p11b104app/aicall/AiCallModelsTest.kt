package com.s15p11b104app.aicall

import org.junit.Assert.assertEquals
import org.junit.Test

class AiCallModelsTest {

  @Test
  fun `통화 시간을 분과 초로 표시한다`() {
    assertEquals("00:00", formatCallDuration(0))
    assertEquals("01:05", formatCallDuration(65))
    assertEquals("59:59", formatCallDuration(3_599))
  }
}
