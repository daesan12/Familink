package com.ssafy.s15p11b104.domain.notification.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.account.entity.User;

class NotificationTest {

	@Test
	void keepsReminderSlotForEventReminder() {
		Notification notification = new Notification(
			mock(User.class),
			NotificationType.EVENT_REMINDER,
			ReminderSlot.DAY_BEFORE,
			"일정 알림",
			"내일 일정이 있습니다."
		);

		assertThat(notification.getReminderSlot()).isEqualTo(ReminderSlot.DAY_BEFORE);
	}
}
