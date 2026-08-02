package com.ssafy.s15p11b104.domain.call.service;

import java.time.Clock;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.call.dto.CallConnectionResultRequest;
import com.ssafy.s15p11b104.domain.call.dto.CallSessionIdResponse;
import com.ssafy.s15p11b104.domain.call.dto.CallTerminationType;
import com.ssafy.s15p11b104.domain.call.dto.ConnectionResult;
import com.ssafy.s15p11b104.domain.call.dto.CreateCallSessionRequest;
import com.ssafy.s15p11b104.domain.call.dto.CreateCallSessionResponse;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationDispatcher;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

@Service
public class CallSessionService {

	private static final Set<CallStatus> ACTIVE_STATUSES = EnumSet.of(
		CallStatus.CONNECTING,
		CallStatus.IN_PROGRESS
	);

	private final CallActorResolver callActorResolver;
	private final GroupMemberCallRepository groupMemberRepository;
	private final CallSessionRepository callSessionRepository;
	private final PersonaCatalog personaCatalog;
	private final AiCallPromptContextProvider promptContextProvider;
	private final AiCallPromptComposer promptComposer;
	private final OpenAiRealtimeGateway realtimeGateway;
	private final SidebandSessionManager sidebandSessionManager;
	private final CallReportGenerationDispatcher callReportGenerationDispatcher;
	private final CallTranscriptService callTranscriptService;
	private final CallSessionLeaseService callSessionLeaseService;
	private final TransactionTemplate transactionTemplate;
	private final Clock clock;

	public CallSessionService(
		CallActorResolver callActorResolver,
		GroupMemberCallRepository groupMemberRepository,
		CallSessionRepository callSessionRepository,
		PersonaCatalog personaCatalog,
		AiCallPromptContextProvider promptContextProvider,
		AiCallPromptComposer promptComposer,
		OpenAiRealtimeGateway realtimeGateway,
		SidebandSessionManager sidebandSessionManager,
		CallReportGenerationDispatcher callReportGenerationDispatcher,
		CallTranscriptService callTranscriptService,
		CallSessionLeaseService callSessionLeaseService,
		TransactionTemplate transactionTemplate,
		Clock clock
	) {
		this.callActorResolver = callActorResolver;
		this.groupMemberRepository = groupMemberRepository;
		this.callSessionRepository = callSessionRepository;
		this.personaCatalog = personaCatalog;
		this.promptContextProvider = promptContextProvider;
		this.promptComposer = promptComposer;
		this.realtimeGateway = realtimeGateway;
		this.sidebandSessionManager = sidebandSessionManager;
		this.callReportGenerationDispatcher = callReportGenerationDispatcher;
		this.callTranscriptService = callTranscriptService;
		this.callSessionLeaseService = callSessionLeaseService;
		this.transactionTemplate = transactionTemplate;
		this.clock = clock;
	}

	public CreateCallSessionResponse create(CreateCallSessionRequest request) {
		validateSdp(request.sdpOffer());
		PersonaDefinition persona = personaCatalog.get(request.personaId());
		CallActor actor = callActorResolver.resolve();
		PreparedCall preparedCall = Objects.requireNonNull(transactionTemplate.execute(status ->
			prepareCall(actor, persona)));

		OpenAiCall openAiCall = null;
		try {
			openAiCall = realtimeGateway.createCall(
				request.sdpOffer(),
				persona,
				preparedCall.instructions(),
				actor.careReceiverMemberId()
			);
			sidebandSessionManager.connect(
				preparedCall.callSessionId(),
				openAiCall.callId(),
				preparedCall.personReferences(),
				this::handleUnexpectedDisconnect
			);
			return new CreateCallSessionResponse(preparedCall.callSessionId(), openAiCall.sdpAnswer());
		} catch (RuntimeException exception) {
			String openAiCallId = openAiCall == null ? null : openAiCall.callId();
			sidebandSessionManager.close(preparedCall.callSessionId());
			realtimeGateway.hangUp(openAiCallId);
			handleUnexpectedDisconnect(preparedCall.callSessionId(), true);
			throw CallApiException.aiConnectionFailed();
		}
	}

	public CallSessionIdResponse recordConnectionResult(
		Long callSessionId,
		CallConnectionResultRequest request
	) {
		validateConnectionResult(request);
		CallActor actor = callActorResolver.resolve();
		Instant now = clock.instant();
		ConnectionResultOutcome outcome = Objects.requireNonNull(transactionTemplate.execute(status -> {
			CallSession session = findOwnedSessionForUpdate(callSessionId, actor);
			CallStatus previousStatus = session.getStatus();
			if (callSessionLeaseService.recoverIfExpired(session, now)) {
				boolean accepted = request.result() == ConnectionResult.FAILED
					&& session.getStatus() == CallStatus.FAILED;
				return new ConnectionResultOutcome(
					accepted,
					ACTIVE_STATUSES.contains(previousStatus) && !ACTIVE_STATUSES.contains(session.getStatus())
				);
			}
			applyConnectionResult(session, request.result(), now);
			return new ConnectionResultOutcome(
				true,
				ACTIVE_STATUSES.contains(previousStatus) && !ACTIVE_STATUSES.contains(session.getStatus())
			);
		}));
		if (outcome.finalizationRequired()) {
			boolean drained = hangUp(callSessionId);
			callTranscriptService.finalizeSession(callSessionId, drained);
		}
		if (!outcome.accepted()) {
			throw CallApiException.invalidCallStatus();
		}
		return new CallSessionIdResponse(callSessionId);
	}

	public CallSessionIdResponse end(Long callSessionId, CallTerminationType terminationType) {
		CallActor actor = callActorResolver.resolve();
		Instant now = clock.instant();
		TerminationResult result = Objects.requireNonNull(transactionTemplate.execute(status -> {
			CallSession session = findOwnedSessionForUpdate(callSessionId, actor);
			callSessionLeaseService.recoverIfExpired(session, now);
			CallStatus previousStatus = session.getStatus();
			try {
				applyTermination(session, terminationType, now);
			} catch (IllegalStateException exception) {
				throw CallApiException.invalidCallStatus();
			}
			boolean finalizationRequired = ACTIVE_STATUSES.contains(previousStatus)
				&& !ACTIVE_STATUSES.contains(session.getStatus());
			return new TerminationResult(session.getId(), finalizationRequired);
		}));
		boolean drained = hangUp(callSessionId);
		boolean reportGenerationRequired = result.finalizationRequired()
			&& callTranscriptService.finalizeSession(result.callSessionId(), drained);
		if (reportGenerationRequired) {
			callReportGenerationDispatcher.dispatch(result.callSessionId());
		}
		return new CallSessionIdResponse(result.callSessionId());
	}

	private void applyTermination(CallSession session, CallTerminationType terminationType, Instant now) {
		if (terminationType == CallTerminationType.CONNECTION_LOST) {
			session.markUnexpectedDisconnect(now);
			return;
		}
		session.endByUser(now);
	}

	private PreparedCall prepareCall(CallActor actor, PersonaDefinition persona) {
		GroupMember careReceiver = groupMemberRepository.findActiveForUpdate(actor.careReceiverMemberId())
			.orElseThrow(() -> CallApiException.forbidden("활성 피보호자 정보를 찾을 수 없습니다."));
		if (careReceiver.getRole() != GroupRole.CARE_RECEIVER) {
			throw CallApiException.forbidden("AI 전화는 피보호자만 사용할 수 있습니다.");
		}
		Instant now = clock.instant();
		callSessionLeaseService.renewAndRecoverForMember(
			sidebandSessionManager.activeSessionIds(),
			careReceiver.getId(),
			now
		);
		if (callSessionRepository.existsByCareReceiverMemberIdAndStatusIn(careReceiver.getId(), ACTIVE_STATUSES)) {
			throw CallApiException.activeCallExists();
		}

		CallSession session = new CallSession(
			careReceiver.getGroup(),
			careReceiver,
			persona.id(),
			CallStatus.CONNECTING
		);
		session.renewLease(callSessionLeaseService.expiresAt(now));
		session = callSessionRepository.save(session);
		AiCallSessionContext sessionContext = promptContextProvider.load(careReceiver);
		String instructions = promptComposer.compose(
			persona,
			careReceiver.getUser().getGender(),
			sessionContext.promptContext()
		);
		return new PreparedCall(session.getId(), instructions, sessionContext.personReferences());
	}

	private CallSession findOwnedSessionForUpdate(Long callSessionId, CallActor actor) {
		return callSessionRepository.findForUpdate(callSessionId, actor.careReceiverMemberId())
			.orElseThrow(CallApiException::callSessionNotFound);
	}

	private void applyConnectionResult(CallSession session, ConnectionResult result, Instant now) {
		if (result == ConnectionResult.CONNECTED && session.getStatus() == CallStatus.IN_PROGRESS) {
			session.renewLease(callSessionLeaseService.expiresAt(now));
			return;
		}
		if (result == ConnectionResult.FAILED && session.getStatus() == CallStatus.FAILED) {
			return;
		}

		try {
			if (result == ConnectionResult.CONNECTED) {
				session.markConnected(now);
				session.renewLease(callSessionLeaseService.expiresAt(now));
			} else {
				session.markConnectionFailed(now);
			}
		} catch (IllegalStateException exception) {
			throw CallApiException.invalidCallStatus();
		}
	}

	private void handleUnexpectedDisconnect(Long callSessionId, Boolean transcriptHealthy) {
		boolean finalizationRequired = Boolean.TRUE.equals(transactionTemplate.execute(status -> {
			CallSession session = callSessionRepository.findByIdForUpdate(callSessionId).orElse(null);
			if (session == null) {
				return false;
			}
			CallStatus previousStatus = session.getStatus();
			session.markUnexpectedDisconnect(clock.instant());
			return ACTIVE_STATUSES.contains(previousStatus) && !ACTIVE_STATUSES.contains(session.getStatus());
		}));
		if (finalizationRequired) {
			callTranscriptService.finalizeSession(callSessionId, Boolean.TRUE.equals(transcriptHealthy));
		}
	}

	private boolean hangUp(Long callSessionId) {
		String openAiCallId = sidebandSessionManager.prepareClose(callSessionId);
		realtimeGateway.hangUp(openAiCallId);
		return sidebandSessionManager.finishClose(callSessionId);
	}

	private void validateSdp(String sdpOffer) {
		if (!StringUtils.hasText(sdpOffer) || !sdpOffer.stripLeading().startsWith("v=0")) {
			throw CallApiException.invalidRequest("유효한 SDP offer가 필요합니다.");
		}
	}

	private void validateConnectionResult(CallConnectionResultRequest request) {
		if (request.result() == ConnectionResult.FAILED && !StringUtils.hasText(request.errorCode())) {
			throw CallApiException.invalidRequest("FAILED 결과에는 error_code가 필요합니다.");
		}
		if (request.result() == ConnectionResult.CONNECTED && StringUtils.hasText(request.errorCode())) {
			throw CallApiException.invalidRequest("CONNECTED 결과에는 error_code를 보낼 수 없습니다.");
		}
	}

	private record PreparedCall(
		Long callSessionId,
		String instructions,
		Map<String, AiCallPersonReference> personReferences
	) {
	}

	private record TerminationResult(Long callSessionId, boolean finalizationRequired) {
	}

	private record ConnectionResultOutcome(boolean accepted, boolean finalizationRequired) {
	}
}
