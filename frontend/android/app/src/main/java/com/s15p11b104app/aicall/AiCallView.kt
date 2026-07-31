package com.s15p11b104app.aicall

import android.widget.FrameLayout
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper

internal class AiCallView(
    private val reactContext: ThemedReactContext,
) : FrameLayout(reactContext) {

  private var accessToken by mutableStateOf<String?>(null)
  private var groupId by mutableStateOf<String?>(null)

  init {
    layoutParams =
        LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT,
        )
    addView(
        ComposeView(reactContext).apply {
          setViewCompositionStrategy(
              ViewCompositionStrategy.DisposeOnDetachedFromWindowOrReleasedFromPool
          )
          setContent {
            AiCallTheme {
              AiCallRoute(
                  bridgeContext = AiCallBridgeContext(accessToken, groupId),
                  onCallResult = ::emitCallResult,
                  onFullscreenChange = ::emitFullscreenChange,
              )
            }
          }
        },
        LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT,
        ),
    )
  }

  internal fun setAccessToken(value: String?) {
    accessToken = value
  }

  internal fun setGroupId(value: String?) {
    groupId = value
  }

  private fun emitFullscreenChange(isFullscreen: Boolean) {
    val eventDispatcher = UIManagerHelper.getEventDispatcher(reactContext)
    eventDispatcher?.dispatchEvent(
        AiCallFullscreenChangeEvent(
            surfaceId = UIManagerHelper.getSurfaceId(reactContext),
            viewId = id,
            isFullscreen = isFullscreen,
        )
    )
  }

  private fun emitCallResult(status: String) {
    val eventDispatcher = UIManagerHelper.getEventDispatcher(reactContext)
    eventDispatcher?.dispatchEvent(
        AiCallResultEvent(
            surfaceId = UIManagerHelper.getSurfaceId(reactContext),
            viewId = id,
            status = status,
        )
    )
  }
}
