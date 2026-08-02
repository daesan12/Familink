package com.ssafy.s15p11b104.domain.call.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;

public interface CallReportCallRepository extends JpaRepository<CallReport, Long> {

	boolean existsByCallSessionId(Long callSessionId);

	Optional<CallReport> findByCallSessionId(Long callSessionId);

	@Query("""
		select report
		from CallReport report
		join fetch report.callSession session
		join fetch session.careReceiverMember member
		where session.status = :status
			and session.endedAt >= :startInclusive
			and session.endedAt < :endExclusive
		order by session.endedAt asc, report.id asc
		""")
	List<CallReport> findCompletedInEndedAtRange(
		@Param("status") CallStatus status,
		@Param("startInclusive") Instant startInclusive,
		@Param("endExclusive") Instant endExclusive
	);

	@Query("""
		select report
		from CallReport report
		join fetch report.callSession session
		join fetch session.careReceiverMember member
		where member.id = :careReceiverMemberId
			and session.status = :status
			and session.endedAt >= :startInclusive
			and session.endedAt < :endExclusive
		order by session.endedAt asc, report.id asc
		""")
	List<CallReport> findCompletedForMemberInEndedAtRange(
		@Param("careReceiverMemberId") Long careReceiverMemberId,
		@Param("status") CallStatus status,
		@Param("startInclusive") Instant startInclusive,
		@Param("endExclusive") Instant endExclusive
	);

	@Query("""
		select report
		from CallReport report
		join fetch report.callSession session
		where session.careReceiverMember.id = :careReceiverMemberId
			and session.status = :status
			and session.endedAt is not null
		order by session.endedAt desc, report.id desc
		""")
	List<CallReport> findRecent(
		@Param("careReceiverMemberId") Long careReceiverMemberId,
		@Param("status") CallStatus status,
		Pageable pageable
	);

	/**
	 * 주어진 통화들 중 건별 리포트가 저장된 통화의 ID만 조회한다.
	 *
	 * <p>일일 리포트 화면이 통화별로 리포트 열람 가능 여부를 표시하는 데 쓴다. 통화마다 존재 여부를
	 * 묻지 않고 한 번에 조회한다.
	 */
	@Query("""
		select report.callSession.id
		from CallReport report
		where report.callSession.id in :callSessionIds
		""")
	List<Long> findCallSessionIdsIn(@Param("callSessionIds") Collection<Long> callSessionIds);
}
