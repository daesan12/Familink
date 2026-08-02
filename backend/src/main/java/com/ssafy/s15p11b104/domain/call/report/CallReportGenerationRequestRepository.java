package com.ssafy.s15p11b104.domain.call.report;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface CallReportGenerationRequestRepository
	extends JpaRepository<CallReportGenerationRequest, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select request from CallReportGenerationRequest request "
		+ "where request.callSessionId = :callSessionId")
	Optional<CallReportGenerationRequest> findByIdForUpdate(@Param("callSessionId") Long callSessionId);

	@Query("""
		select request.callSessionId
		from CallReportGenerationRequest request
		where request.status = :pending
			or (request.status = :claimed and request.claimExpiresAt <= :now)
		order by request.createdAt, request.callSessionId
		""")
	List<Long> findDispatchableIds(
		@Param("pending") CallReportGenerationStatus pending,
		@Param("claimed") CallReportGenerationStatus claimed,
		@Param("now") Instant now,
		Pageable pageable
	);
}
