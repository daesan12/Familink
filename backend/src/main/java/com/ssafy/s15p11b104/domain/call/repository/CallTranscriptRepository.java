package com.ssafy.s15p11b104.domain.call.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;

public interface CallTranscriptRepository extends JpaRepository<CallTranscript, Long> {

	boolean existsByCallSessionIdAndOpenaiItemId(Long callSessionId, String openaiItemId);

	Optional<CallTranscript> findByCallSessionIdAndOpenaiItemId(Long callSessionId, String openaiItemId);

	List<CallTranscript> findAllByCallSessionIdOrderBySequenceNumberAsc(Long callSessionId);

	long countByCallSessionId(Long callSessionId);

	@Query("select coalesce(max(transcript.sequenceNumber), 0) from CallTranscript transcript "
		+ "where transcript.callSession.id = :callSessionId")
	int findMaxSequenceNumber(@Param("callSessionId") Long callSessionId);
}
