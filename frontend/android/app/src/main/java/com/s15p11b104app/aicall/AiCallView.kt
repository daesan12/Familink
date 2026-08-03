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

  private val accessTokenProvider =
      BridgeAiCallAccessTokenProvider(onRefreshRequested = ::emitAccessTokenRefreshRequest)
  private var apiBaseUrl by mutableStateOf<String?>(null)
  private var groupId: String? = null

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
                  apiBaseUrl = apiBaseUrl,
                  accessTokenProvider = accessTokenProvider,
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
    accessTokenProvider.updateAccessToken(value)
  }

  internal fun setApiBaseUrl(value: String?) {
    apiBaseUrl = value
  }

  internal fun setGroupId(value: String?) {
    groupId = value
  }

  internal fun completeAccessTokenRefresh(
      requestId: String,
      accessToken: String,
      errorCode: String,
  ) {
    accessTokenProvider.completeRefresh(requestId, accessToken, errorCode)
  }

  override fun onDetachedFromWindow() {
    accessTokenProvider.cancelPendingRequests()
    super.onDetachedFromWindow()
  }

  private fun emitAccessTokenRefreshRequest(requestId: String) {
    val eventDispatcher = UIManagerHelper.getEventDispatcher(reactContext)
    eventDispatcher?.dispatchEvent(
        AiCallAccessTokenRefreshRequestEvent(
            surfaceId = UIManagerHelper.getSurfaceId(reactContext),
            viewId = id,
            requestId = requestId,
        )
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
