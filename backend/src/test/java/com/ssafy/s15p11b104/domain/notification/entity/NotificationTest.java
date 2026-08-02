package com.ssafy.s15p11b104.domain.notification.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;

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

	@Test
	void linksEventAndGroupForEventReminder() {
		FamilyGroup group = mock(FamilyGroup.class);
		CalendarEvent event = mock(CalendarEvent.class);
		when(event.getGroup()).thenReturn(group);
		User receiver = mock(User.class);

		Notification notification = Notification.eventReminder(
			receiver,
			event,
			ReminderSlot.HOUR_BEFORE,
			"일정 시작 알림",
			"1시간 후 14:00에 '병원 방문' 일정이 시작됩니다."
		);

		assertThat(notification.getType()).isEqualTo(NotificationType.EVENT_REMINDER);
		assertThat(notification.getReceiver()).isSameAs(receiver);
		assertThat(notification.getRelatedEvent()).isSameAs(event);
		assertThat(notification.getGroup()).isSameAs(group);
		assertThat(notification.getReminderSlot()).isEqualTo(ReminderSlot.HOUR_BEFORE);
		assertThat(notification.getTitle()).isEqualTo("일정 시작 알림");
		assertThat(notification.getBody()).isEqualTo("1시간 후 14:00에 '병원 방문' 일정이 시작됩니다.");
	}

	@Test
	void leavesActorEmptyForSchedulerOriginatedReminder() {
		CalendarEvent event = mock(CalendarEvent.class);
		when(event.getGroup()).thenReturn(mock(FamilyGroup.class));

		Notification notification = Notification.eventReminder(
			mock(User.class), event, ReminderSlot.DAY_BEFORE, "내일 일정 알림", "내일 '병원 방문' 일정이 있습니다.");

		assertThat(notification.getActor()).isNull();
	}
}
