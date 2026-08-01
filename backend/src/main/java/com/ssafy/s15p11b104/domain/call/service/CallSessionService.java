package com.ssafy.s15p11b104.domain.call.service;

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
	private final TransactionTemplate transactionTemplate;

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
		TransactionTemplate transactionTemplate
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
		this.transactionTemplate = transactionTemplate;
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
			handleUnexpectedDisconnect(preparedCall.callSessionId());
			throw CallApiException.aiConnectionFailed();
		}
	}

	public CallSessionIdResponse recordConnectionResult(
		Long callSessionId,
		CallConnectionResultRequest request
	) {
		validateConnectionResult(request);
		CallActor actor = callActorResolver.resolve();
		Objects.requireNonNull(transactionTemplate.execute(status -> {
			CallSession session = findOwnedSessionForUpdate(callSessionId, actor);
			applyConnectionResult(session, request.result());
			return session.getId();
		}));

		if (request.result() == ConnectionResult.FAILED) {
			hangUp(callSessionId);
		}
		return new CallSessionIdResponse(callSessionId);
	}

	public CallSessionIdResponse end(Long callSessionId, CallTerminationType terminationType) {
		CallActor actor = callActorResolver.resolve();
		TerminationResult result = Objects.requireNonNull(transactionTemplate.execute(status -> {
			CallSession session = findOwnedSessionForUpdate(callSessionId, actor);
			CallStatus previousStatus = session.getStatus();
			try {
				applyTermination(session, terminationType);
			} catch (IllegalStateException exception) {
				throw CallApiException.invalidCallStatus();
			}
			boolean reportGenerationRequired = previousStatus == CallStatus.IN_PROGRESS
				&& session.getStatus() == CallStatus.COMPLETED;
			return new TerminationResult(session.getId(), reportGenerationRequired);
		}));
		hangUp(callSessionId);
		if (result.reportGenerationRequired()) {
			callReportGenerationDispatcher.dispatch(result.callSessionId());
		}
		return new CallSessionIdResponse(result.callSessionId());
	}

	private void applyTermination(CallSession session, CallTerminationType terminationType) {
		if (terminationType == CallTerminationType.CONNECTION_LOST) {
			session.markUnexpectedDisconnect(Instant.now());
			return;
		}
		session.endByUser(Instant.now());
	}

	private PreparedCall prepareCall(CallActor actor, PersonaDefinition persona) {
		GroupMember careReceiver = groupMemberRepository.findActiveForUpdate(actor.careReceiverMemberId())
			.orElseThrow(() -> CallApiException.forbidden("활성 피보호자 정보를 찾을 수 없습니다."));
		if (careReceiver.getRole() != GroupRole.CARE_RECEIVER) {
			throw CallApiException.forbidden("AI 전화는 피보호자만 사용할 수 있습니다.");
		}
		if (callSessionRepository.existsByCareReceiverMemberIdAndStatusIn(careReceiver.getId(), ACTIVE_STATUSES)) {
			throw CallApiException.activeCallExists();
		}

		CallSession session = callSessionRepository.save(new CallSession(
			careReceiver.getGroup(),
			careReceiver,
			persona.id(),
			CallStatus.CONNECTING
		));
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

	private void applyConnectionResult(CallSession session, ConnectionResult result) {
		if (result == ConnectionResult.CONNECTED && session.getStatus() == CallStatus.IN_PROGRESS) {
			return;
		}
		if (result == ConnectionResult.FAILED && session.getStatus() == CallStatus.FAILED) {
			return;
		}

		try {
			if (result == ConnectionResult.CONNECTED) {
				session.markConnected(Instant.now());
			} else {
				session.markConnectionFailed(Instant.now());
			}
		} catch (IllegalStateException exception) {
			throw CallApiException.invalidCallStatus();
		}
	}

	private void handleUnexpectedDisconnect(long callSessionId) {
		transactionTemplate.executeWithoutResult(status ->
			callSessionRepository.findByIdForUpdate(callSessionId)
				.ifPresent(session -> session.markUnexpectedDisconnect(Instant.now())));
	}

	private void hangUp(Long callSessionId) {
		String openAiCallId = sidebandSessionManager.prepareClose(callSessionId);
		realtimeGateway.hangUp(openAiCallId);
		sidebandSessionManager.finishClose(callSessionId);
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

	private record TerminationResult(Long callSessionId, boolean reportGenerationRequired) {
	}
}
