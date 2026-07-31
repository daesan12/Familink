package com.s15p11b104app.aicall

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

internal class AiCallFullscreenChangeEvent(
    surfaceId: Int,
    viewId: Int,
    private val isFullscreen: Boolean,
) : Event<AiCallFullscreenChangeEvent>(surfaceId, viewId) {

  override fun getEventName(): String = EVENT_NAME

  override fun getEventData(): WritableMap =
      Arguments.createMap().apply { putBoolean("isFullscreen", isFullscreen) }

  companion object {
    const val EVENT_NAME = "onFullscreenChange"
  }
}
