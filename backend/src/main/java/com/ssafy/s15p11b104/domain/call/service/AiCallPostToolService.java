package com.ssafy.s15p11b104.domain.call.service;

import java.util.List;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.PostAnalysisCallRepository;
import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;

@Service
public class AiCallPostToolService {

	private static final Set<CallStatus> ACTIVE_STATUSES = Set.of(
		CallStatus.CONNECTING,
		CallStatus.IN_PROGRESS
	);
	private static final int MAX_SUMMARY_COUNT = 5;

	private final CallSessionRepository callSessionRepository;
	private final GroupMemberCallRepository groupMemberRepository;
	private final PostAnalysisCallRepository postAnalysisRepository;

	public AiCallPostToolService(
		CallSessionRepository callSessionRepository,
		GroupMemberCallRepository groupMemberRepository,
		PostAnalysisCallRepository postAnalysisRepository
	) {
		this.callSessionRepository = callSessionRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.postAnalysisRepository = postAnalysisRepository;
	}

	@Transactional(readOnly = true)
	public AiCallToolResult getRecentPostSummaries(
		Long callSessionId,
		String personKey,
		AiCallPersonReference reference
	) {
		CallSession callSession = callSessionRepository.findById(callSessionId).orElse(null);
		if (callSession == null
			|| !ACTIVE_STATUSES.contains(callSession.getStatus())
			|| callSession.getCareReceiverMember().getLeftAt() != null) {
			return AiCallToolResult.unavailable(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		}

		Long groupId = callSession.getGroup().getId();
		if (groupMemberRepository.findActiveInGroup(reference.groupMemberId(), groupId).isEmpty()) {
			return AiCallToolResult.unavailable(AiCallToolResult.Reason.PERSON_NOT_AVAILABLE);
		}

		List<String> summaries = postAnalysisRepository.findRecentSuccessfulSummariesByAuthor(
			groupId,
			reference.groupMemberId(),
			AnalysisStatus.SUCCESS,
			PageRequest.of(0, MAX_SUMMARY_COUNT)
		);
		return AiCallToolResult.success(personKey, reference, summaries);
	}
}
