package com.ssafy.s15p11b104.domain.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.scheduling.annotation.Scheduled;

class EventReminderSchedulerTest {

	@Test
	void remindsWithCurrentInstantFromApplicationClock() {
		EventReminderService service = Mockito.mock(EventReminderService.class);
		Instant now = Instant.parse("2026-08-09T00:00:30Z");
		EventReminderScheduler scheduler =
			new EventReminderScheduler(service, Clock.fixed(now, ZoneOffset.UTC));

		scheduler.schedule();

		verify(service).createDueReminders(now);
	}

	@Test
	void pollsOnAConfigurableFixedDelay() throws NoSuchMethodException {
		Method method = EventReminderScheduler.class.getDeclaredMethod("schedule");
		Scheduled scheduled = method.getAnnotation(Scheduled.class);

		assertThat(scheduled.fixedDelayString()).isEqualTo("${app.event-reminder.fixed-delay-ms:60000}");
		assertThat(scheduled.initialDelayString()).isEqualTo("${app.event-reminder.initial-delay-ms:60000}");
	}
}
