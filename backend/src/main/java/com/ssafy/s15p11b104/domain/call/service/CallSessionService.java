package com.ssafy.s15p11b104.domain.call.service;

import java.time.Clock;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

	private static final Logger LOGGER = LoggerFactory.getLogger(CallSessionService.class);

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
	private final CallTeardownExecutor callTeardownExecutor;
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
		CallTeardownExecutor callTeardownExecutor,
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
		this.callTeardownExecutor = callTeardownExecutor;
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
			LOGGER.error(
				"AI 통화 세션 생성에 실패했습니다. callSessionId={}, personaId={}",
				preparedCall.callSessionId(),
				persona.id(),
				exception
			);
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

	/**
	 * 통화 종료를 접수한다.
	 *
	 * <p>종료 상태와 종료 시각을 확정하고 Sideband 소유권을 가져오는 것까지만 요청 스레드에서
	 * 수행하고, OpenAI hangup·남은 이벤트 drain·전사 마감·리포트 접수는 응답 뒤로 넘긴다.
	 * 사용자는 이 뒷정리를 기다릴 이유가 없고, 계약도 비동기 접수({@code 202})다.
	 */
	public CallSessionIdResponse end(Long callSessionId, CallTerminationType terminationType) {
		CallActor actor = callActorResolver.resolve();
		Instant now = clock.instant();
		// claim은 소켓을 맵에서 꺼내 오므로 트랜잭션이 커밋에 실패하면 회수할 경로가 없다.
		// 반환값에만 의존하지 않고 여기에 담아 두었다가 실패 시 직접 정리한다.
		AtomicReference<SidebandSessionManager.ClosingSideband> claimedSideband =
			new AtomicReference<>();
		TerminationResult result;
		try {
			result = Objects.requireNonNull(transactionTemplate.execute(status -> {
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
				// 커밋 전에 소유권을 가져와 정상 종료 예정으로 표시한다. 커밋 후로 미루면 그 틈에
				// 도착한 remote close가 예상치 못한 단절로 처리돼 소켓이 먼저 정리되고, 뒤늦은
				// 뒷정리가 drain 실패로 판정한다.
				claimedSideband.set(sidebandSessionManager.claimClose(callSessionId));
				return new TerminationResult(
					session.getId(),
					finalizationRequired,
					claimedSideband.get()
				);
			}));
		} catch (RuntimeException exception) {
			releaseClaimedSideband(callSessionId, claimedSideband.get());
			throw exception;
		}
		if (result.closingSideband() != null) {
			callTeardownExecutor.execute(() -> tearDownClaimedSession(
				result.callSessionId(),
				result.closingSideband(),
				result.finalizationRequired()
			));
		}
		return new CallSessionIdResponse(result.callSessionId());
	}

	/**
	 * 소유권을 가져온 통화의 뒷정리를 수행한다.
	 *
	 * <p>순서를 바꾸지 않는다. {@code finishClose}가 전사 핸들러를 닫은 뒤에 마감해야
	 * 마감 이후 유입된 이벤트로 무결성이 오염되지 않는다. 실패해도 보상 마감을 시도하지
	 * 않는다. drain 실패로 마감하면 세션이 복구 불가능한 상태가 된다.
	 */
	private void tearDownClaimedSession(
		Long callSessionId,
		SidebandSessionManager.ClosingSideband closingSideband,
		boolean finalizationRequired
	) {
		try {
			boolean drained;
			// 소켓 해제는 유일한 회수 지점이므로 앞 단계가 실패해도 반드시 수행한다.
			try {
				realtimeGateway.hangUp(closingSideband.callId());
			} finally {
				drained = closingSideband.finishClose();
			}
			boolean reportGenerationRequired = finalizationRequired
				&& callTranscriptService.finalizeSession(callSessionId, drained);
			if (reportGenerationRequired) {
				callReportGenerationDispatcher.dispatch(callSessionId);
			}
		} catch (RuntimeException exception) {
			LOGGER.error(
				"통화 종료 뒷정리에 실패했습니다. callSessionId={}, errorType={}",
				callSessionId,
				exception.getClass().getSimpleName()
			);
		}
	}

	/**
	 * 종료 상태를 확정하지 못한 채 이미 가져온 Sideband 소유권을 되돌린다.
	 *
	 * <p>세션은 롤백돼 그대로 활성 상태이지만 소켓은 이미 맵에서 빠졌고 정상 종료 예정으로
	 * 표시돼 remote close로도 회수되지 않는다. 그대로 두면 소켓과 전사 핸들러가 남아 lease
	 * 갱신 대상에서도 사라지므로, 여기서 닫아 준다.
	 */
	private void releaseClaimedSideband(
		Long callSessionId,
		SidebandSessionManager.ClosingSideband closingSideband
	) {
		if (closingSideband == null) {
			return;
		}
		try {
			try {
				realtimeGateway.hangUp(closingSideband.callId());
			} finally {
				closingSideband.finishClose();
			}
		} catch (RuntimeException exception) {
			LOGGER.error(
				"종료 실패 후 Sideband 세션을 정리하지 못했습니다. callSessionId={}, errorType={}",
				callSessionId,
				exception.getClass().getSimpleName()
			);
		}
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
		SidebandSessionManager.ClosingSideband closingSideband =
			sidebandSessionManager.claimClose(callSessionId);
		if (closingSideband == null) {
			realtimeGateway.hangUp(null);
			return false;
		}
		realtimeGateway.hangUp(closingSideband.callId());
		return closingSideband.finishClose();
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

	private record TerminationResult(
		Long callSessionId,
		boolean finalizationRequired,
		SidebandSessionManager.ClosingSideband closingSideband
	) {
	}

	private record ConnectionResultOutcome(boolean accepted, boolean finalizationRequired) {
	}
}
