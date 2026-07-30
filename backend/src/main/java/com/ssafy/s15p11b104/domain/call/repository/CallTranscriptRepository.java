package com.ssafy.s15p11b104.domain.call.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;

public interface CallTranscriptRepository extends JpaRepository<CallTranscript, Long> {

	boolean existsByCallSessionIdAndOpenaiItemId(Long callSessionId, String openaiItemId);

	List<CallTranscript> findAllByCallSessionIdOrderBySequenceNumberAsc(Long callSessionId);
}
