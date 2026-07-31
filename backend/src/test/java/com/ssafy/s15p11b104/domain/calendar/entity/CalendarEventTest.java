package com.ssafy.s15p11b104.domain.calendar.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;

class CalendarEventTest {

	@Test
	void preservesReminderScheduleTimestampWhenOnlyNonScheduleFieldsChange() {
		Instant registeredAt = Instant.parse("2026-08-01T00:00:00Z");
		Instant editedAt = Instant.parse("2026-08-01T01:00:00Z");
		LocalDate eventDate = LocalDate.of(2026, 8, 2);
		GroupMember creator = mock(GroupMember.class);
		CalendarEvent event = new CalendarEvent(
			mock(FamilyGroup.class),
			creator,
			"기존 제목",
			"기존 설명",
			eventDate,
			eventDate,
			null,
			null,
			registeredAt);

		event.update(
			creator,
			"변경된 제목",
			"변경된 설명",
			eventDate,
			eventDate,
			null,
			null,
			editedAt);

		assertThat(event.getReminderScheduleUpdatedAt()).isEqualTo(registeredAt);
	}

	@Test
	void advancesReminderScheduleTimestampWhenScheduleChanges() {
		Instant registeredAt = Instant.parse("2026-08-01T00:00:00Z");
		Instant changedAt = Instant.parse("2026-08-01T01:00:00Z");
		LocalDate originalDate = LocalDate.of(2026, 8, 2);
		LocalDate changedDate = originalDate.plusDays(1);
		GroupMember creator = mock(GroupMember.class);
		CalendarEvent event = new CalendarEvent(
			mock(FamilyGroup.class),
			creator,
			"일정",
			null,
			originalDate,
			originalDate,
			null,
			null,
			registeredAt);

		event.update(
			creator,
			"일정",
			null,
			changedDate,
			changedDate,
			null,
			null,
			changedAt);

		assertThat(event.getReminderScheduleUpdatedAt()).isEqualTo(changedAt);
	}
}
