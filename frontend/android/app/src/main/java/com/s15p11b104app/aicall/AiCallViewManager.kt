package com.s15p11b104app.aicall

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.AiCallViewManagerDelegate
import com.facebook.react.viewmanagers.AiCallViewManagerInterface

@ReactModule(name = AiCallViewManager.REACT_CLASS)
internal class AiCallViewManager :
    SimpleViewManager<AiCallView>(),
    AiCallViewManagerInterface<AiCallView> {

  private val delegate: AiCallViewManagerDelegate<AiCallView, AiCallViewManager> =
      AiCallViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<AiCallView> = delegate

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(context: ThemedReactContext): AiCallView = AiCallView(context)

  override fun setAccessToken(view: AiCallView, value: String?) {
    view.setAccessToken(value)
  }

  override fun setGroupId(view: AiCallView, value: String?) {
    view.setGroupId(value)
  }

  override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> =
      mapOf(
          AiCallFullscreenChangeEvent.EVENT_NAME to
              mapOf("registrationName" to "onFullscreenChange"),
          AiCallResultEvent.EVENT_NAME to
              mapOf("registrationName" to "onCallResult")
      )

  companion object {
    const val REACT_CLASS = "AiCallView"
  }
}
