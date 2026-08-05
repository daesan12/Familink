package com.s15p11b104app.notifications

import com.facebook.react.ReactApplication
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM 토큰 갱신을 React Native에 전달하고, 앱이 실행 중일 때 도착한 메시지를 표시한다.
 *
 * 서버가 `notification` 페이로드를 보내므로 백그라운드·종료 상태의 알림 표시는 Android
 * 시스템이 처리하고 [onMessageReceived]는 호출되지 않는다. 앱이 실행 중일 때는 시스템이
 * 표시하지 않고 이 콜백으로만 전달하므로 여기서 직접 표시해야 한다.
 */
internal class FamilinkMessagingService : FirebaseMessagingService() {

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)

    emitPushReceived()

    val presentation = NotificationPresenter.presentationOf(remoteMessage) ?: return
    NotificationPresenter.show(this, presentation)
  }

  // 표시 판정과 무관하게 알린다. 배지 미읽음 수의 근거는 서버에 저장된 내부 알림이므로
  // 표시 문구가 비어 OS 알림을 건너뛰는 메시지라도 배지는 갱신 대상이다.
  private fun emitPushReceived() {
    val reactContext =
        (application as? ReactApplication)?.reactHost?.currentReactContext ?: return
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    reactContext.emitDeviceEvent(PUSH_RECEIVED_EVENT, null)
  }

  // onRegistered가 신규 콜백이지만 register()를 호출한 앱에만 전달된다.
  // 토큰 획득 경로를 getToken으로 유지하는 동안에는 onNewToken이 유일한 갱신 신호다.
  @Suppress("DEPRECATION")
  @Deprecated("firebase-messaging 25.1.1에서 deprecated. register/onRegistered 전환 시 함께 제거한다.")
  override fun onNewToken(token: String) {
    @Suppress("DEPRECATION")
    super.onNewToken(token)

    // React Native가 살아 있을 때만 전달한다. 컨텍스트가 없으면 다음 로그인
    // 또는 세션 복원 시 React Native가 토큰을 재조회해 등록한다.
    val reactContext =
        (application as? ReactApplication)?.reactHost?.currentReactContext ?: return
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    reactContext.emitDeviceEvent(TOKEN_REFRESH_EVENT, token)
  }

  companion object {
    /** TypeScript `FCM_TOKEN_REFRESH_EVENT`와 문자열이 같아야 한다. */
    const val TOKEN_REFRESH_EVENT = "FamilinkNotifications:tokenRefresh"

    /** TypeScript `PUSH_RECEIVED_EVENT`와 문자열이 같아야 한다. */
    const val PUSH_RECEIVED_EVENT = "FamilinkNotifications:pushReceived"
  }
}
