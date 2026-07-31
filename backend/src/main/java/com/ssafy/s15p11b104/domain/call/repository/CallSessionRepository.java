package com.ssafy.s15p11b104.domain.call.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;

import jakarta.persistence.LockModeType;

public interface CallSessionRepository extends JpaRepository<CallSession, Long> {

	boolean existsByCareReceiverMemberIdAndStatusIn(Long careReceiverMemberId, Collection<CallStatus> statuses);

	Optional<CallSession> findByIdAndCareReceiverMemberId(Long id, Long careReceiverMemberId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select session
		from CallSession session
		where session.id = :sessionId
			and session.careReceiverMember.id = :careReceiverMemberId
		""")
	Optional<CallSession> findForUpdate(
		@Param("sessionId") Long sessionId,
		@Param("careReceiverMemberId") Long careReceiverMemberId
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select session from CallSession session where session.id = :sessionId")
	Optional<CallSession> findByIdForUpdate(@Param("sessionId") Long sessionId);

	@Query("""
		select distinct session.careReceiverMember.id
		from CallSession session
		where session.status = :status
			and session.endedAt >= :startInclusive
			and session.endedAt < :endExclusive
			and not exists (
				select report.id
				from CallReport report
				where report.callSession.id = session.id
			)
		""")
	List<Long> findCareReceiverMemberIdsWithCompletedWithoutReportInEndedAtRange(
		@Param("status") CallStatus status,
		@Param("startInclusive") Instant startInclusive,
		@Param("endExclusive") Instant endExclusive
	);
}
