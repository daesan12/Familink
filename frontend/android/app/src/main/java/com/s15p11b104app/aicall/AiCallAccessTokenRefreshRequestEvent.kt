package com.s15p11b104app.aicall

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

internal class AiCallAccessTokenRefreshRequestEvent(
    surfaceId: Int,
    viewId: Int,
    private val requestId: String,
) : Event<AiCallAccessTokenRefreshRequestEvent>(surfaceId, viewId) {

  override fun getEventName(): String = EVENT_NAME

  override fun getEventData(): WritableMap =
      Arguments.createMap().apply { putString("requestId", requestId) }

  companion object {
    const val EVENT_NAME = "onAccessTokenRefreshRequested"
  }
}
