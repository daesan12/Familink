package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.scheduling.annotation.Scheduled;

class DailyReportSchedulerTest {

	@Test
	void dispatchesKoreanStandardTimeDateFromUtcApplicationClock() {
		DailyReportGenerationDispatcher dispatcher = Mockito.mock(DailyReportGenerationDispatcher.class);
		Clock clock = Clock.fixed(Instant.parse("2026-07-30T13:00:00Z"), ZoneOffset.UTC);
		DailyReportScheduler scheduler = new DailyReportScheduler(dispatcher, clock);

		scheduler.schedule();

		verify(dispatcher).dispatch(LocalDate.of(2026, 7, 30));
	}

	@Test
	void usesTheContractCronAndTimeZone() throws NoSuchMethodException {
		Method method = DailyReportScheduler.class.getDeclaredMethod("schedule");
		Scheduled scheduled = method.getAnnotation(Scheduled.class);

		assertThat(scheduled.cron()).isEqualTo("0 0 22 * * *");
		assertThat(scheduled.zone()).isEqualTo("Asia/Seoul");
	}
}
