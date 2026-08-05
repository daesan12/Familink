package com.s15p11b104app.notifications

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationTapStoreTest {

  @After
  fun clearStore() {
    NotificationTapStore.consume()
  }

  @Test
  fun `보관한 탭을 1회만 소비한다`() {
    NotificationTapStore.record(NotificationTapStore.Tap("1024", "NEW_POST"))

    assertEquals(
        NotificationTapStore.Tap("1024", "NEW_POST"),
        NotificationTapStore.consume(),
    )
    assertNull(NotificationTapStore.consume())
  }

  @Test
  fun `보관분이 없으면 null을 반환한다`() {
    assertNull(NotificationTapStore.consume())
  }

  @Test
  fun `새 탭이 이전 탭을 대체한다`() {
    NotificationTapStore.record(NotificationTapStore.Tap("1", "NEW_POST"))
    NotificationTapStore.record(NotificationTapStore.Tap("2", null))

    assertEquals(NotificationTapStore.Tap("2", null), NotificationTapStore.consume())
  }
}
