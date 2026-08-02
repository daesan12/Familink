package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.scheduling.annotation.Scheduled;

class CallSessionLeaseSchedulerTest {

	private static final Instant NOW = Instant.parse("2026-08-02T03:00:00Z");

	@Test
	void recoversExpiredSessionsOnStartup() {
		CallSessionLeaseService service = Mockito.mock(CallSessionLeaseService.class);
		SidebandSessionManager manager = Mockito.mock(SidebandSessionManager.class);
		CallSessionLeaseScheduler scheduler = new CallSessionLeaseScheduler(
			service,
			manager,
			Clock.fixed(NOW, ZoneOffset.UTC)
		);

		scheduler.recoverOnStartup();

		verify(service).recoverExpired(NOW);
	}

	@Test
	void renewsOwnedSessionsBeforePeriodicRecovery() {
		CallSessionLeaseService service = Mockito.mock(CallSessionLeaseService.class);
		SidebandSessionManager manager = Mockito.mock(SidebandSessionManager.class);
		Set<Long> activeSessionIds = Set.of(1L, 2L);
		when(manager.activeSessionIds()).thenReturn(activeSessionIds);
		CallSessionLeaseScheduler scheduler = new CallSessionLeaseScheduler(
			service,
			manager,
			Clock.fixed(NOW, ZoneOffset.UTC)
		);

		scheduler.renewAndRecover();

		verify(service).renewAndRecover(activeSessionIds, NOW);
	}

	@Test
	void usesApprovedThirtySecondSchedule() throws NoSuchMethodException {
		Method method = CallSessionLeaseScheduler.class.getDeclaredMethod("renewAndRecover");
		Scheduled scheduled = method.getAnnotation(Scheduled.class);

		assertThat(scheduled.fixedDelayString()).isEqualTo("${app.ai-call-lease.fixed-delay-ms:30000}");
		assertThat(scheduled.initialDelayString()).isEqualTo("${app.ai-call-lease.initial-delay-ms:30000}");
	}
}
