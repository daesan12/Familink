package com.ssafy.s15p11b104.domain.notification.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class EventReminderTimesTest {

	@Test
	void resolvesDayBeforeDueAtAsNineInBusinessZone() {
		Instant dueAt = EventReminderTimes.dayBeforeDueAt(LocalDate.of(2026, 8, 10));

		assertThat(dueAt).isEqualTo(Instant.parse("2026-08-09T00:00:00Z"));
	}

	@Test
	void resolvesHourBeforeDueAtOneHourEarlier() {
		Instant dueAt = EventReminderTimes.hourBeforeDueAt(Instant.parse("2026-08-10T05:00:00Z"));

		assertThat(dueAt).isEqualTo(Instant.parse("2026-08-10T04:00:00Z"));
	}

	@Test
	void hasNoDayBeforeTargetBeforeNineInBusinessZone() {
		Instant beforeNine = Instant.parse("2026-08-08T23:59:59Z");

		assertThat(EventReminderTimes.dayBeforeTargetDate(beforeNine)).isEmpty();
	}

	@Test
	void targetsNextDayFromNineInBusinessZone() {
		Instant atNine = Instant.parse("2026-08-09T00:00:00Z");

		assertThat(EventReminderTimes.dayBeforeTargetDate(atNine)).contains(LocalDate.of(2026, 8, 10));
	}

	@Test
	void targetsNextDayUntilEndOfBusinessDay() {
		Instant lastMinuteOfBusinessDay = Instant.parse("2026-08-09T14:59:59Z");

		assertThat(EventReminderTimes.dayBeforeTargetDate(lastMinuteOfBusinessDay))
			.contains(LocalDate.of(2026, 8, 10));
	}

	@Test
	void resolvesHourBeforeScanUntilOneHourLater() {
		Instant until = EventReminderTimes.hourBeforeScanUntil(Instant.parse("2026-08-10T04:00:00Z"));

		assertThat(until).isEqualTo(Instant.parse("2026-08-10T05:00:00Z"));
	}
}
