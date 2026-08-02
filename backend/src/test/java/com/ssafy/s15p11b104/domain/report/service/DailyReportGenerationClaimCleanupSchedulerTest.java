package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.scheduling.annotation.Scheduled;

class DailyReportGenerationClaimCleanupSchedulerTest {

	@Test
	void removesClaimsExpiredAtCurrentApplicationTime() {
		Instant now = Instant.parse("2026-08-02T06:00:00Z");
		DailyReportGenerationClaimCleanupService service = Mockito.mock(
			DailyReportGenerationClaimCleanupService.class);
		DailyReportGenerationClaimCleanupScheduler scheduler = new DailyReportGenerationClaimCleanupScheduler(
			service, Clock.fixed(now, ZoneOffset.UTC));

		scheduler.cleanup();

		verify(service).cleanup(now);
	}

	@Test
	void usesOneMinuteFixedDelay() throws NoSuchMethodException {
		Method method = DailyReportGenerationClaimCleanupScheduler.class.getDeclaredMethod("cleanup");
		Scheduled scheduled = method.getAnnotation(Scheduled.class);

		assertThat(scheduled.fixedDelayString())
			.isEqualTo("${app.daily-report.claim-cleanup-delay-ms:60000}");
		assertThat(scheduled.initialDelayString())
			.isEqualTo("${app.daily-report.claim-cleanup-initial-delay-ms:60000}");
	}
}
