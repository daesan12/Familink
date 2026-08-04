package com.s15p11b104app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.s15p11b104app.aicall.AiCallPackage
import com.s15p11b104app.notifications.NotificationPresenter
import com.s15p11b104app.notifications.NotificationsPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(AiCallPackage())
          add(NotificationsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // 백그라운드 알림은 FCM SDK가 표시하므로, 그 전에 채널이 존재해야 한다.
    NotificationPresenter.ensureChannel(this)
    loadReactNative(this)
  }
}
