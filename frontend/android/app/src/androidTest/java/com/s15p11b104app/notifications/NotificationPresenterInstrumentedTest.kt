package com.s15p11b104app.notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.os.Bundle
import android.service.notification.StatusBarNotification
import com.google.firebase.messaging.RemoteMessage
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.s15p11b104app.R
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * 실제 기기의 `NotificationManager`를 거쳐 알림이 표시되는지 확인한다.
 *
 * 채널 생성과 알림 게시는 Android 프레임워크에 의존하므로 단위 테스트로 덮을 수 없다.
 */
@RunWith(AndroidJUnit4::class)
class NotificationPresenterInstrumentedTest {

  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context = instrumentation.targetContext
  private val manager = context.getSystemService(NotificationManager::class.java)
  private val channelId: String
    get() = context.getString(R.string.default_notification_channel_id)

  @Before
  fun setUp() {
    instrumentation.uiAutomation.grantRuntimePermission(
        context.packageName, Manifest.permission.POST_NOTIFICATIONS)
    manager.cancelAll()
    awaitNotifications { it.isEmpty() }
    NotificationPresenter.ensureChannel(context)
  }

  @After
  fun tearDown() {
    manager.cancelAll()
  }

  // dex 040 미만에서는 메서드 이름에 공백을 쓸 수 없어 밑줄로 구분한다.
  @Test
  fun `알림_채널이_헤드업_중요도로_생성된다`() {
    val channel = manager.getNotificationChannel(channelId)

    assertNotNull(channel)
    assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.importance)
  }

  @Test
  fun `수신한_알림을_해당_채널로_표시한다`() {
    val presentation =
        NotificationPresenter.toPresentation(
            title = "새 게시글",
            body = "어머니가 새 게시글을 올렸습니다.",
            notificationId = "9999",
        )
    assertNotNull(presentation)

    NotificationPresenter.show(context, presentation!!)

    val posted = awaitNotifications { it.size == 1 }.single()
    assertEquals("9999", posted.tag)
    assertEquals(channelId, posted.notification.channelId)
    assertEquals("새 게시글", posted.title)
    assertEquals("어머니가 새 게시글을 올렸습니다.", posted.text)
  }

  @Test
  fun `알림_식별자가_다르면_서로_대체하지_않는다`() {
    listOf("1" to "첫 번째", "2" to "두 번째").forEach { (id, title) ->
      show(title = title, notificationId = id)
    }

    assertEquals(2, awaitNotifications { it.size == 2 }.size)
  }

  @Test
  fun `같은_알림_식별자는_기존_알림을_갱신한다`() {
    listOf("이전 제목", "수정된 제목").forEach { title ->
      show(title = title, notificationId = "42")
    }

    val posted = awaitNotifications { it.size == 1 && it.single().title == "수정된 제목" }.single()
    assertEquals("수정된 제목", posted.title)
  }

  @Test
  fun `수신_메시지에서_표시_문구와_식별자를_뽑아낸다`() {
    val remoteMessage =
        RemoteMessage(
            Bundle().apply {
              // 서버가 실제로 보내는 형태. notification payload는 gcm 접두사로,
              // data payload는 일반 키로 전달된다. `gcm.n.e`가 없으면 firebase-messaging이
              // 이 번들을 notification payload로 인식하지 않는다.
              putString(GCM_NOTIFICATION_MARKER, "1")
              putString("gcm.notification.title", "새 게시글이 올라왔어요")
              putString("gcm.notification.body", "김정호님이 새 게시글을 올렸어요.")
              putString("notificationId", "45")
              putString("type", "POST_CREATED")
            })

    val presentation = NotificationPresenter.presentationOf(remoteMessage)

    assertEquals("새 게시글이 올라왔어요", presentation?.title)
    assertEquals("김정호님이 새 게시글을 올렸어요.", presentation?.body)
    assertEquals("45", presentation?.tag)
  }

  @Test
  fun `표시_문구가_없는_메시지는_표시하지_않는다`() {
    val remoteMessage =
        RemoteMessage(
            Bundle().apply {
              putString(GCM_NOTIFICATION_MARKER, "1")
              putString("notificationId", "45")
            })

    assertNull(NotificationPresenter.presentationOf(remoteMessage))
  }

  private fun show(title: String, notificationId: String) {
    val presentation =
        NotificationPresenter.toPresentation(
            title = title, body = "본문", notificationId = notificationId)
    NotificationPresenter.show(context, presentation!!)
  }

  /**
   * `notify`와 `cancelAll`은 시스템에 비동기로 반영되므로 기대 상태가 될 때까지 기다린다.
   * 제한 시간을 넘기면 마지막 상태를 반환해 호출한 단언이 실패를 보고하게 한다.
   */
  private fun awaitNotifications(
      condition: (List<StatusBarNotification>) -> Boolean,
  ): List<StatusBarNotification> {
    val deadline = System.currentTimeMillis() + AWAIT_TIMEOUT_MS
    var current = manager.activeNotifications.toList()
    while (!condition(current) && System.currentTimeMillis() < deadline) {
      Thread.sleep(AWAIT_POLL_MS)
      current = manager.activeNotifications.toList()
    }
    return current
  }

  private val StatusBarNotification.title: String?
    get() = notification.extras.getString(Notification.EXTRA_TITLE)

  private val StatusBarNotification.text: String?
    get() = notification.extras.getString(Notification.EXTRA_TEXT)

  private companion object {
    const val AWAIT_TIMEOUT_MS = 2_000L
    const val AWAIT_POLL_MS = 50L

    /** firebase-messaging이 번들을 notification payload로 판정하는 키. */
    const val GCM_NOTIFICATION_MARKER = "gcm.n.e"
  }
}
