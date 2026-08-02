package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.call.dto.CallConnectionResultRequest;
import com.ssafy.s15p11b104.domain.call.dto.CallTerminationType;
import com.ssafy.s15p11b104.domain.call.dto.ConnectionResult;
import com.ssafy.s15p11b104.domain.call.dto.CreateCallSessionRequest;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationDispatcher;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

@ExtendWith(MockitoExtension.class)
class CallSessionServiceTest {

	private static final long CALL_SESSION_ID = 1L;
	private static final long CARE_RECEIVER_MEMBER_ID = 2L;
	private static final String OPEN_AI_CALL_ID = "call_123";
	private static final Instant NOW = Instant.parse("2026-08-02T03:00:00Z");
	private static final Instant LEASE_EXPIRES_AT = NOW.plusSeconds(90);

	@Mock
	private CallActorResolver callActorResolver;

	@Mock
	private GroupMemberCallRepository groupMemberRepository;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private PersonaCatalog personaCatalog;

	@Mock
	private AiCallPromptContextProvider promptContextProvider;

	@Mock
	private AiCallPromptComposer promptComposer;

	@Mock
	private OpenAiRealtimeGateway realtimeGateway;

	@Mock
	private SidebandSessionManager sidebandSessionManager;

	@Mock
	private CallReportGenerationDispatcher callReportGenerationDispatcher;

	@Mock
	private CallTranscriptService callTranscriptService;

	@Mock
	private CallSessionLeaseService callSessionLeaseService;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private CallSession callSession;

	@Mock
	private GroupMember careReceiver;

	@Mock
	private FamilyGroup familyGroup;

	@Mock
	private User user;

	private CallSessionService callSessionService;

	@BeforeEach
	void setUp() {
		callSessionService = new CallSessionService(
			callActorResolver,
			groupMemberRepository,
			callSessionRepository,
			personaCatalog,
			promptContextProvider,
			promptComposer,
			realtimeGateway,
			sidebandSessionManager,
			callReportGenerationDispatcher,
			callTranscriptService,
			callSessionLeaseService,
			transactionTemplate,
			Clock.fixed(NOW, ZoneOffset.UTC)
		);
		when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			TransactionCallback<?> callback = invocation.getArgument(0);
			return callback.doInTransaction(null);
		});
		when(callActorResolver.resolve()).thenReturn(new CallActor(CARE_RECEIVER_MEMBER_ID));
	}

	@Test
	void passesServerOnlyPersonReferencesToSidebandSession() {
		PersonaDefinition persona = new PersonaCatalog().get(1L);
		AiCallPromptContext promptContext = new AiCallPromptContext(
			new AiCallPromptContext.CareReceiverContext(
				"피보호자",
				List.of(),
				LocalDate.of(2026, 7, 30)
			),
			List.of(new AiCallPromptContext.FamilyMemberContext("person_1", "민지", "큰딸")),
			List.of(),
			List.of()
		);
		Map<String, AiCallPersonReference> references = Map.of(
			"person_1",
			new AiCallPersonReference(10L, "민지", "큰딸")
		);
		when(personaCatalog.get(1L)).thenReturn(persona);
		when(groupMemberRepository.findActiveForUpdate(CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(careReceiver));
		when(careReceiver.getId()).thenReturn(CARE_RECEIVER_MEMBER_ID);
		when(careReceiver.getRole()).thenReturn(GroupRole.CARE_RECEIVER);
		when(careReceiver.getGroup()).thenReturn(familyGroup);
		when(careReceiver.getUser()).thenReturn(user);
		when(user.getGender()).thenReturn(UserGender.FEMALE);
		when(callSession.getId()).thenReturn(CALL_SESSION_ID);
		when(callSessionRepository.save(any(CallSession.class))).thenReturn(callSession);
		when(promptContextProvider.load(careReceiver))
			.thenReturn(new AiCallSessionContext(promptContext, references));
		when(promptComposer.compose(persona, UserGender.FEMALE, promptContext)).thenReturn("instructions");
		when(realtimeGateway.createCall(anyString(), eq(persona), eq("instructions"), eq(CARE_RECEIVER_MEMBER_ID)))
			.thenReturn(new OpenAiCall(OPEN_AI_CALL_ID, "v=0\r\ns=openai\r\n"));
		when(sidebandSessionManager.activeSessionIds()).thenReturn(Set.of());
		when(callSessionLeaseService.expiresAt(NOW)).thenReturn(LEASE_EXPIRES_AT);

		callSessionService.create(new CreateCallSessionRequest(1L, "v=0\r\ns=browser\r\n"));

		verify(callSessionLeaseService).renewAndRecoverForMember(Set.of(), CARE_RECEIVER_MEMBER_ID, NOW);
		verify(sidebandSessionManager).connect(
			eq(CALL_SESSION_ID),
			eq(OPEN_AI_CALL_ID),
			eq(references),
			any()
		);
	}

	@Test
	void endsCallByUserRequest() {
		stubOwnedSessionForEnd();
		when(callSession.getStatus()).thenReturn(CallStatus.IN_PROGRESS, CallStatus.COMPLETED);
		when(callTranscriptService.finalizeSession(CALL_SESSION_ID, true)).thenReturn(true);

		callSessionService.end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED);

		verify(callSession).endByUser(any(Instant.class));
		verify(callSession, never()).markUnexpectedDisconnect(any(Instant.class));
		InOrder closeOrder = inOrder(
			sidebandSessionManager,
			realtimeGateway,
			callTranscriptService,
			callReportGenerationDispatcher
		);
		closeOrder.verify(sidebandSessionManager).prepareClose(CALL_SESSION_ID);
		closeOrder.verify(realtimeGateway).hangUp(OPEN_AI_CALL_ID);
		closeOrder.verify(sidebandSessionManager).finishClose(CALL_SESSION_ID);
		closeOrder.verify(callTranscriptService).finalizeSession(CALL_SESSION_ID, true);
		closeOrder.verify(callReportGenerationDispatcher).dispatch(CALL_SESSION_ID);
	}

	@Test
	void marksConnectionLostAsUnexpectedDisconnect() {
		stubOwnedSessionForEnd();
		when(callSession.getStatus()).thenReturn(CallStatus.IN_PROGRESS, CallStatus.INCOMPLETE);

		callSessionService.end(CALL_SESSION_ID, CallTerminationType.CONNECTION_LOST);

		verify(callSession).markUnexpectedDisconnect(any(Instant.class));
		verify(callSession, never()).endByUser(any(Instant.class));
		verify(realtimeGateway).hangUp(OPEN_AI_CALL_ID);
		verify(callReportGenerationDispatcher, never()).dispatch(any());
	}

	@Test
	void doesNotDispatchReportForDuplicateCompletedEnd() {
		stubOwnedSessionForEnd();
		when(callSession.getStatus()).thenReturn(CallStatus.COMPLETED, CallStatus.COMPLETED);

		callSessionService.end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED);

		verify(callReportGenerationDispatcher, never()).dispatch(any());
	}

	@Test
	void rejectsLateConnectedResultAfterRecoveringExpiredSessionAndClosesCall() {
		stubOwnedSession();
		when(callSessionLeaseService.recoverIfExpired(callSession, NOW)).thenReturn(true);
		when(callSession.getStatus()).thenReturn(CallStatus.CONNECTING, CallStatus.FAILED);

		assertThatThrownBy(
			() -> callSessionService.recordConnectionResult(
				CALL_SESSION_ID,
				new CallConnectionResultRequest(ConnectionResult.CONNECTED, null)
			)
		)
			.isInstanceOfSatisfying(
				CallApiException.class,
				exception -> assertThat(exception.getCode()).isEqualTo("INVALID_CALL_STATUS")
			);

		verify(callSessionLeaseService).recoverIfExpired(callSession, NOW);
		verify(callSession, never()).markConnected(any(Instant.class));
		verify(sidebandSessionManager).prepareClose(CALL_SESSION_ID);
		verify(realtimeGateway).hangUp(OPEN_AI_CALL_ID);
		verify(sidebandSessionManager).finishClose(CALL_SESSION_ID);
	}

	@Test
	void doesNotFinalizeAgainForDuplicateFailedConnectionResult() {
		when(callSessionRepository.findForUpdate(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(callSession));
		when(callSession.getStatus()).thenReturn(CallStatus.FAILED);

		callSessionService.recordConnectionResult(
			CALL_SESSION_ID,
			new CallConnectionResultRequest(ConnectionResult.FAILED, "provider_failed")
		);

		verify(callSession, never()).markConnectionFailed(any(Instant.class));
		verify(sidebandSessionManager, never()).prepareClose(any());
		verify(callTranscriptService, never()).finalizeSession(any(), anyBoolean());
	}

	@Test
	void preservesRecoveredIncompleteStatusForLateUserEnd() {
		stubOwnedSessionForEnd();
		when(callSessionLeaseService.recoverIfExpired(callSession, NOW)).thenReturn(true);
		when(callSession.getStatus()).thenReturn(CallStatus.INCOMPLETE, CallStatus.INCOMPLETE);

		callSessionService.end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED);

		verify(callSessionLeaseService).recoverIfExpired(callSession, NOW);
		verify(callSession).endByUser(NOW);
		verify(callReportGenerationDispatcher, never()).dispatch(any());
	}

	private void stubOwnedSession() {
		when(callSessionRepository.findForUpdate(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(callSession));
		when(sidebandSessionManager.prepareClose(CALL_SESSION_ID)).thenReturn(OPEN_AI_CALL_ID);
		when(sidebandSessionManager.finishClose(CALL_SESSION_ID)).thenReturn(true);
	}

	private void stubOwnedSessionForEnd() {
		stubOwnedSession();
		when(callSession.getId()).thenReturn(CALL_SESSION_ID);
	}
}
