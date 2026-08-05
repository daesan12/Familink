package com.ssafy.s15p11b104.domain.call.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallTranscriptEvent;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIngestStatus;

import jakarta.persistence.LockModeType;

public interface CallTranscriptEventRepository extends JpaRepository<CallTranscriptEvent, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select event
		from CallTranscriptEvent event
		where event.callSession.id = :callSessionId
			and event.openaiItemId = :openaiItemId
		""")
	Optional<CallTranscriptEvent> findForUpdate(
		@Param("callSessionId") Long callSessionId,
		@Param("openaiItemId") String openaiItemId
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select event from CallTranscriptEvent event where event.id = :eventId")
	Optional<CallTranscriptEvent> findByIdForUpdate(@Param("eventId") Long eventId);

	@Query("select coalesce(max(event.sequenceNumber), 0) from CallTranscriptEvent event "
		+ "where event.callSession.id = :callSessionId")
	int findMaxSequenceNumber(@Param("callSessionId") Long callSessionId);

	long countByCallSessionIdAndStatusNot(Long callSessionId, TranscriptIngestStatus status);

	long countByCallSessionIdAndStatus(Long callSessionId, TranscriptIngestStatus status);

	@Query("""
		select event.id
		from CallTranscriptEvent event
		where event.status = :status
			and event.attemptCount >= :maximumAttempts
			and event.claimExpiresAt <= :now
		order by event.id
		""")
	List<Long> findExhaustedClaimIds(
		@Param("status") TranscriptIngestStatus status,
		@Param("maximumAttempts") int maximumAttempts,
		@Param("now") Instant now,
		Pageable pageable
	);

	@Query("""
		select event.id
		from CallTranscriptEvent event
		where event.status in :statuses
			and event.createdAt <= :cutoff
			and event.content is not null
		order by event.id
		""")
	List<Long> findStalePayloadIds(
		@Param("statuses") Collection<TranscriptIngestStatus> statuses,
		@Param("cutoff") Instant cutoff,
		Pageable pageable
	);
}
