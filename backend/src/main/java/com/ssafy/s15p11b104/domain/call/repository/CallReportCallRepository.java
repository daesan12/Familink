package com.ssafy.s15p11b104.domain.call.repository;

import java.time.Instant;
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
}
