package com.s15p11b104app.notifications

/**
 * 알림 탭 정보를 React Native가 소비할 때까지 보관한다.
 *
 * 콜드 스타트에서는 탭 시점에 React 컨텍스트가 없어 이벤트를 보낼 수 없다.
 * MainActivity가 여기에 기록해 두면 React Native가 부팅 후
 * `consumePendingNotificationTap`으로 가져간다. 최신 탭 1건만 의미가 있다.
 */
internal object NotificationTapStore {

  internal data class Tap(val notificationId: String, val type: String?)

  private var pending: Tap? = null

  @Synchronized
  fun record(tap: Tap) {
    pending = tap
  }

  /** 보관된 탭을 반환하고 비운다. 없으면 `null`. */
  @Synchronized
  fun consume(): Tap? {
    val tap = pending
    pending = null
    return tap
  }

  /** TypeScript `NOTIFICATION_TAP_EVENT`와 문자열이 같아야 한다. */
  const val NOTIFICATION_TAP_EVENT = "FamilinkNotifications:notificationTap"
}
