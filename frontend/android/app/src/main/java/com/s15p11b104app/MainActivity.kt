package com.s15p11b104app

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.s15p11b104app.notifications.NotificationPresenter
import com.s15p11b104app.notifications.NotificationTapStore

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "S15P11B104App"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // 시스템이 보관한 launch intent에는 removeExtra가 적용되지 않아, 프로세스 종료 후
    // 최근 앱 재실행이 같은 extras를 다시 전달한다. 히스토리 재실행은 새 탭이 아니므로
    // 건너뛴다.
    if (intent != null && intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0) {
      return
    }
    // onCreate 시점에는 React 인스턴스가 살아 있어도 JS 리스너가 아직 마운트 전일 수
    // 있어 이벤트가 유실된다. 항상 보관해 React Native가 부팅 후 pull로 가져가게 한다.
    extractNotificationTap(intent)?.let { NotificationTapStore.record(it) }
  }

  // launchMode="singleTask"라 앱이 살아 있을 때의 알림 탭은 새 Activity가 아니라
  // 이 콜백으로 들어온다. React가 살아 있으면 즉시 이벤트로 보내고, 아니면 보관한다.
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    val tap = extractNotificationTap(intent) ?: return

    val reactContext = (application as? ReactApplication)?.reactHost?.currentReactContext
    if (reactContext != null && reactContext.hasActiveReactInstance()) {
      val payload =
          Arguments.createMap().apply {
            putString("notificationId", tap.notificationId)
            putString("type", tap.type)
          }
      reactContext.emitDeviceEvent(NotificationTapStore.NOTIFICATION_TAP_EVENT, payload)
    } else {
      NotificationTapStore.record(tap)
    }
  }

  /** 알림 탭 intent extras를 읽고 제거한다. 알림 탭이 아니면 `null`. */
  private fun extractNotificationTap(intent: Intent?): NotificationTapStore.Tap? {
    val notificationId =
        intent?.getStringExtra(NotificationPresenter.DATA_NOTIFICATION_ID)?.trim()
    if (notificationId.isNullOrEmpty()) {
      return null
    }
    val type =
        intent.getStringExtra(NotificationPresenter.DATA_TYPE)?.trim()?.takeIf { it.isNotEmpty() }
    intent.removeExtra(NotificationPresenter.DATA_NOTIFICATION_ID)
    intent.removeExtra(NotificationPresenter.DATA_TYPE)
    return NotificationTapStore.Tap(notificationId, type)
  }
}
