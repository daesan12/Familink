package com.s15p11b104app.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.RemoteMessage
import com.s15p11b104app.MainActivity
import com.s15p11b104app.R

/**
 * 앱이 실행 중일 때 수신한 푸시를 OS 알림으로 표시한다.
 *
 * 백그라운드·종료 상태에서는 FCM SDK가 Manifest의 `default_notification_channel_id`
 * 채널로 직접 표시하므로 이 경로를 거치지 않는다. 두 경로가 같은 채널과 같은 중요도를
 * 쓰도록 [ensureChannel]을 `Application.onCreate`에서 호출한다.
 */
internal object NotificationPresenter {

  /** 알림을 갱신 단위로 묶는 고정 ID. 서로 다른 알림은 [Presentation.tag]로 구분한다. */
  private const val NOTIFICATION_ID = 0

  /** 서버가 data payload에 담는 알림 식별자 키. `NotificationPushService`와 같아야 한다. */
  private const val DATA_NOTIFICATION_ID = "notificationId"

  /** 표시할 알림 내용. 제목과 본문 중 최소 하나는 비어 있지 않다. */
  internal data class Presentation(
    val tag: String?,
    val title: String,
    val body: String,
  )

  /**
   * 알림 채널을 만든다. 같은 ID로 다시 호출해도 안전하다.
   *
   * FCM SDK는 Manifest에 선언된 채널이 실제로 없으면 자체 폴백 채널로 되돌리고,
   * 그 채널은 헤드업 배너가 뜨지 않는 중요도로 생성된다. 그래서 프로세스가 시작될 때
   * 채널 존재를 보장해야 백그라운드 알림도 상단에 표시된다.
   */
  fun ensureChannel(context: Context) {
    val channel =
      NotificationChannelCompat.Builder(
          context.getString(R.string.default_notification_channel_id),
          NotificationManagerCompat.IMPORTANCE_HIGH,
        )
        .setName(context.getString(R.string.default_notification_channel_name))
        .build()
    NotificationManagerCompat.from(context).createNotificationChannel(channel)
  }

  /**
   * 수신한 메시지에서 표시 대상을 뽑아낸다. 표시 문구는 서버가 `notification` payload로,
   * 알림 식별자는 `data` payload로 보내므로 둘을 각각 읽는다.
   */
  fun presentationOf(remoteMessage: RemoteMessage): Presentation? =
      toPresentation(
          title = remoteMessage.notification?.title,
          body = remoteMessage.notification?.body,
          notificationId = remoteMessage.data[DATA_NOTIFICATION_ID],
      )

  /**
   * 표시 대상을 판정한다. 제목과 본문이 모두 비어 있으면 표시할 내용이 없으므로 `null`을
   * 반환하며 대체 문구를 만들지 않는다.
   */
  fun toPresentation(title: String?, body: String?, notificationId: String?): Presentation? {
    val resolvedTitle = title?.trim().orEmpty()
    val resolvedBody = body?.trim().orEmpty()
    if (resolvedTitle.isEmpty() && resolvedBody.isEmpty()) {
      return null
    }
    return Presentation(
      tag = notificationId?.trim()?.takeIf { it.isNotEmpty() },
      title = resolvedTitle,
      body = resolvedBody,
    )
  }

  /** 알림을 표시한다. 알림 권한이 없으면 시스템이 조용히 무시한다. */
  fun show(context: Context, presentation: Presentation) {
    val builder =
      NotificationCompat.Builder(
          context,
          context.getString(R.string.default_notification_channel_id),
        )
        .setSmallIcon(R.mipmap.ic_launcher)
        .setAutoCancel(true)
        // Android 8 미만에서는 채널 중요도가 없어 헤드업 여부를 이 값이 결정한다.
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(contentIntent(context))
    if (presentation.title.isNotEmpty()) {
      builder.setContentTitle(presentation.title)
    }
    if (presentation.body.isNotEmpty()) {
      builder.setContentText(presentation.body)
    }
    NotificationManagerCompat.from(context)
      .notify(presentation.tag, NOTIFICATION_ID, builder.build())
  }

  private fun contentIntent(context: Context): PendingIntent {
    val intent =
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
