package com.s15p11b104app.notifications

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

internal class NotificationsPackage : BaseReactPackage() {
  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? =
      if (name == FamilinkNotificationsModule.NAME) {
        FamilinkNotificationsModule(reactContext)
      } else {
        null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            FamilinkNotificationsModule.NAME to
                ReactModuleInfo(
                    FamilinkNotificationsModule.NAME,
                    FamilinkNotificationsModule::class.java.name,
                    false,
                    false,
                    false,
                    false,
                ),
        )
      }
}
