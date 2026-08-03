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

    session.close()
    session.close()

    assertEquals(previousMode, audioManager.mode)
    assertEquals(previousSpeakerphoneOn, audioManager.isSpeakerphoneOn)
  }
}
