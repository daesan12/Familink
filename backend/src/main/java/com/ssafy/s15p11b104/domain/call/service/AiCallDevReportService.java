package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.dto.AiCallDevReportResponse;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;

@Service
@Profile("ai-call-dev")
public class AiCallDevReportService {

	private final CallActorResolver callActorResolver;
	private final CallSessionRepository callSessionRepository;
	private final CallReportCallRepository callReportRepository;

	public AiCallDevReportService(
		CallActorResolver callActorResolver,
		CallSessionRepository callSessionRepository,
		CallReportCallRepository callReportRepository
	) {
		this.callActorResolver = callActorResolver;
		this.callSessionRepository = callSessionRepository;
		this.callReportRepository = callReportRepository;
	}

	@Transactional(readOnly = true)
	public AiCallDevReportResponse get(Long callSessionId) {
		CallActor actor = callActorResolver.resolve();
		CallSession session = callSessionRepository.findByIdAndCareReceiverMemberId(
			callSessionId,
			actor.careReceiverMemberId()
		).orElseThrow(CallApiException::callSessionNotFound);

		return callReportRepository.findByCallSessionId(callSessionId)
			.map(AiCallDevReportResponse::ready)
			.orElseGet(() -> session.getStatus() == CallStatus.COMPLETED
				? AiCallDevReportResponse.pending(callSessionId)
				: AiCallDevReportResponse.notApplicable(callSessionId));
	}
}
