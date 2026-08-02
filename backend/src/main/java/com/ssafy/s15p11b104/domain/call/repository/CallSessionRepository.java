package com.ssafy.s15p11b104.domain.call.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;

import jakarta.persistence.LockModeType;

public interface CallSessionRepository extends JpaRepository<CallSession, Long> {

	boolean existsByCareReceiverMemberIdAndStatusIn(Long careReceiverMemberId, Collection<CallStatus> statuses);

	@Modifying
	@Query("""
		update CallSession session
		set session.leaseExpiresAt = :leaseExpiresAt
		where session.id in :sessionIds
			and session.status in :activeStatuses
		""")
	int renewActiveLeases(
		@Param("sessionIds") Set<Long> sessionIds,
		@Param("activeStatuses") Collection<CallStatus> activeStatuses,
		@Param("leaseExpiresAt") Instant leaseExpiresAt
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select session
		from CallSession session
		where session.status in :activeStatuses
			and (session.leaseExpiresAt is null or session.leaseExpiresAt <= :now)
		order by session.id
		""")
	List<CallSession> findExpiredForUpdate(
		@Param("activeStatuses") Collection<CallStatus> activeStatuses,
		@Param("now") Instant now
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select session
		from CallSession session
		where session.careReceiverMember.id = :careReceiverMemberId
			and session.status in :activeStatuses
			and (session.leaseExpiresAt is null or session.leaseExpiresAt <= :now)
		order by session.id
		""")
	List<CallSession> findExpiredForMemberForUpdate(
		@Param("careReceiverMemberId") Long careReceiverMemberId,
		@Param("activeStatuses") Collection<CallStatus> activeStatuses,
		@Param("now") Instant now
	);

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

	/**
	 * 한 피보호자의 통화 중 종료 시각이 구간에 드는 것을 상태로 걸러 조회한다.
	 *
	 * <p>일일 리포트 화면의 통화 목록을 만드는 데 쓴다. 구간은 호출자가 업무 시간대 기준일에서
	 * 파생한 UTC 절대 시각으로 넘긴다.
	 */
	@Query("""
		select session
		from CallSession session
		where session.careReceiverMember.id = :careReceiverMemberId
			and session.status = :status
			and session.endedAt >= :startInclusive
			and session.endedAt < :endExclusive
		order by session.endedAt asc, session.id asc
		""")
	List<CallSession> findByCareReceiverMemberAndStatusInEndedAtRange(
		@Param("careReceiverMemberId") Long careReceiverMemberId,
		@Param("status") CallStatus status,
		@Param("startInclusive") Instant startInclusive,
		@Param("endExclusive") Instant endExclusive
	);
}
