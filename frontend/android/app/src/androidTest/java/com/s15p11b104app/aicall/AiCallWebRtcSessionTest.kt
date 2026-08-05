package com.s15p11b104app.aicall

import android.content.Context
import android.media.AudioManager
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test

class AiCallWebRtcSessionTest {

  @Test
  fun close는_오디오_라우팅을_복원하고_반복해도_안전하다() {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val previousMode = audioManager.mode
    val previousSpeakerphoneOn = audioManager.isSpeakerphoneOn

    val session =
        AiCallWebRtcSession(
            context = context,
            onCaptionUpdate = {},
            onConnectionLost = {},
        )

    // 세션 생성은 스피커폰을 끈 상태로 시작하므로, 기기 기본값이 이미 꺼짐이면 복원을
    // 생략해도 아래 단정이 통과한다. 기본값의 반대로 한 번 바꿔 복원을 실제로 검증한다.
    // 이 호출이 실제로 반영되는지는 단정하지 않는다. 수화기가 없는 폼팩터에서는
    // 스피커에서 벗어날 수 없어 기기별로 결과가 달라진다.
    session.setSpeakerEnabled(!previousSpeakerphoneOn)

    session.close()
    session.close()

    assertEquals(previousMode, audioManager.mode)
    assertEquals(previousSpeakerphoneOn, audioManager.isSpeakerphoneOn)
  }
}
