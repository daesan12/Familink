package com.ssafy.s15p11b104.domain.call.service;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.config.CallSessionLeaseProperties;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;

@Service
public class CallSessionLeaseService {

	private static final Set<CallStatus> ACTIVE_STATUSES = EnumSet.of(
		CallStatus.CONNECTING,
		CallStatus.IN_PROGRESS
	);

	private final CallSessionRepository callSessionRepository;
	private final CallSessionLeaseProperties properties;

	public CallSessionLeaseService(
		CallSessionRepository callSessionRepository,
		CallSessionLeaseProperties properties
	) {
		this.callSessionRepository = callSessionRepository;
		this.properties = properties;
	}

	public Instant expiresAt(Instant now) {
		return now.plus(properties.getLeaseDuration());
	}

	@Transactional
	public void renewAndRecover(Set<Long> locallyActiveSessionIds, Instant now) {
		renewLocallyActiveSessions(locallyActiveSessionIds, now);
		recover(callSessionRepository.findExpiredForUpdate(ACTIVE_STATUSES, now), now);
	}

	@Transactional
	public void renewAndRecoverForMember(
		Set<Long> locallyActiveSessionIds,
		Long careReceiverMemberId,
		Instant now
	) {
		renewLocallyActiveSessions(locallyActiveSessionIds, now);
		recover(callSessionRepository.findExpiredForMemberForUpdate(
			careReceiverMemberId,
			ACTIVE_STATUSES,
			now
		), now);
	}

	@Transactional
	public void recoverExpired(Instant now) {
		recover(callSessionRepository.findExpiredForUpdate(ACTIVE_STATUSES, now), now);
	}

	public boolean recoverIfExpired(CallSession session, Instant now) {
		if (!session.isLeaseExpiredAt(now)) {
			return false;
		}
		session.markUnexpectedDisconnect(now);
		return true;
	}

	private void renewLocallyActiveSessions(Set<Long> sessionIds, Instant now) {
		if (sessionIds.isEmpty()) {
			return;
		}
		callSessionRepository.renewActiveLeases(sessionIds, ACTIVE_STATUSES, expiresAt(now));
	}

	private void recover(List<CallSession> sessions, Instant now) {
		for (CallSession session : sessions) {
			recoverIfExpired(session, now);
		}
	}
}
