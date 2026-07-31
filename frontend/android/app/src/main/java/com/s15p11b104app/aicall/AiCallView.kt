package com.s15p11b104app.aicall

import android.widget.FrameLayout
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper

internal class AiCallView(
    private val reactContext: ThemedReactContext,
) : FrameLayout(reactContext) {

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
}
