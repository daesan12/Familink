package com.s15p11b104app.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationPresenterTest {

  @Test
  fun `제목과 본문이 있으면 그대로 표시한다`() {
    val presentation =
        NotificationPresenter.toPresentation(
            title = "새 게시글",
            body = "어머니가 새 게시글을 올렸습니다.",
            notificationId = "1024",
        )

    assertEquals("새 게시글", presentation?.title)
    assertEquals("어머니가 새 게시글을 올렸습니다.", presentation?.body)
    assertEquals("1024", presentation?.tag)
  }

  @Test
  fun `제목만 있으면 본문을 비워 표시한다`() {
    val presentation =
        NotificationPresenter.toPresentation(title = "새 게시글", body = null, notificationId = "7")

    assertEquals("새 게시글", presentation?.title)
    assertEquals("", presentation?.body)
  }

  @Test
  fun `본문만 있으면 제목을 비워 표시한다`() {
    val presentation =
        NotificationPresenter.toPresentation(title = null, body = "댓글이 달렸습니다.", notificationId = "7")

    assertEquals("", presentation?.title)
    assertEquals("댓글이 달렸습니다.", presentation?.body)
  }

  @Test
  fun `앞뒤 공백을 제거한다`() {
    val presentation =
        NotificationPresenter.toPresentation(
            title = "  새 게시글  ",
            body = "\n댓글이 달렸습니다.\n",
            notificationId = " 1024 ",
        )

    assertEquals("새 게시글", presentation?.title)
    assertEquals("댓글이 달렸습니다.", presentation?.body)
    assertEquals("1024", presentation?.tag)
  }

  @Test
  fun `제목과 본문이 모두 없으면 표시하지 않는다`() {
    assertNull(
        NotificationPresenter.toPresentation(title = null, body = null, notificationId = "1024"))
  }

  @Test
  fun `제목과 본문이 모두 공백이면 표시하지 않는다`() {
    assertNull(
        NotificationPresenter.toPresentation(title = "   ", body = "\t\n", notificationId = "1024"))
  }

  @Test
  fun `알림 식별자가 없으면 태그를 비운다`() {
    assertNull(
        NotificationPresenter.toPresentation(title = "새 게시글", body = null, notificationId = null)
            ?.tag)
    assertNull(
        NotificationPresenter.toPresentation(title = "새 게시글", body = null, notificationId = "  ")
            ?.tag)
  }
}
