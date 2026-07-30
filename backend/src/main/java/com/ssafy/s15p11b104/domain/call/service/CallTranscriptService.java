package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;

@Service
public class CallTranscriptService {

	private final CallSessionRepository callSessionRepository;
	private final CallTranscriptRepository callTranscriptRepository;

	public CallTranscriptService(
		CallSessionRepository callSessionRepository,
		CallTranscriptRepository callTranscriptRepository
	) {
		this.callSessionRepository = callSessionRepository;
		this.callTranscriptRepository = callTranscriptRepository;
	}

	@Transactional
	public boolean saveIfAbsent(
		Long callSessionId,
		SpeakerType speaker,
		String content,
		int sequenceNumber,
		String openaiItemId
	) {
		if (callTranscriptRepository.existsByCallSessionIdAndOpenaiItemId(callSessionId, openaiItemId)) {
			return false;
		}

		CallSession callSession = callSessionRepository.findById(callSessionId)
			.orElseThrow(() -> new IllegalStateException("전사를 저장할 통화 세션을 찾을 수 없습니다."));
		callTranscriptRepository.save(new CallTranscript(
			callSession,
			speaker,
			content,
			sequenceNumber,
			openaiItemId
		));
		return true;
	}
}
