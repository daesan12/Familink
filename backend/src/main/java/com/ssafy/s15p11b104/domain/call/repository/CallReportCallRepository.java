package com.ssafy.s15p11b104.domain.call.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;

public interface CallReportCallRepository extends JpaRepository<CallReport, Long> {

	boolean existsByCallSessionId(Long callSessionId);

	Optional<CallReport> findByCallSessionId(Long callSessionId);

	@Query("""
		select report
		from CallReport report
		join fetch report.callSession session
		where session.careReceiverMember.id = :careReceiverMemberId
			and session.endedAt is not null
		order by session.endedAt desc
		""")
	List<CallReport> findRecent(
		@Param("careReceiverMemberId") Long careReceiverMemberId,
		Pageable pageable
	);
}
