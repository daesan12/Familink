package com.ssafy.s15p11b104.domain.call.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.call.config.CallSessionLeaseProperties;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;

@ExtendWith(MockitoExtension.class)
class CallSessionLeaseServiceTest {

	private static final Instant NOW = Instant.parse("2026-08-02T03:00:00Z");
	private static final Instant LEASE_EXPIRES_AT = NOW.plusSeconds(90);

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private CallSession expiredSession;

	private CallSessionLeaseService callSessionLeaseService;

	@BeforeEach
	void setUp() {
		CallSessionLeaseProperties properties = new CallSessionLeaseProperties();
		properties.setLeaseDuration(Duration.ofSeconds(90));
		callSessionLeaseService = new CallSessionLeaseService(callSessionRepository, properties);
	}

	@Test
	void renewsLocallyActiveSessionsBeforeRecoveringExpiredSessions() {
		Set<Long> locallyActiveSessionIds = Set.of(1L, 2L);
		when(expiredSession.isLeaseExpiredAt(NOW)).thenReturn(true);
		when(callSessionRepository.findExpiredForUpdate(anyCollection(), eq(NOW)))
			.thenReturn(List.of(expiredSession));

		callSessionLeaseService.renewAndRecover(locallyActiveSessionIds, NOW);

		verify(callSessionRepository).renewActiveLeases(
			eq(locallyActiveSessionIds),
			anyCollection(),
			eq(LEASE_EXPIRES_AT)
		);
		verify(expiredSession).markUnexpectedDisconnect(NOW);
	}

	@Test
	void recoversExpiredMemberSessionsWithoutEmptyLeaseUpdate() {
		when(expiredSession.isLeaseExpiredAt(NOW)).thenReturn(true);
		when(callSessionRepository.findExpiredForMemberForUpdate(eq(7L), anyCollection(), eq(NOW)))
			.thenReturn(List.of(expiredSession));

		callSessionLeaseService.renewAndRecoverForMember(Set.of(), 7L, NOW);

		verify(callSessionRepository, never()).renewActiveLeases(any(), anyCollection(), any());
		verify(expiredSession).markUnexpectedDisconnect(NOW);
	}
}
