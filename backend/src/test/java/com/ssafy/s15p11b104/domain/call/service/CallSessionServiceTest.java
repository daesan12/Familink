package com.ssafy.s15p11b104.domain.call.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.dto.CallTerminationType;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;

@ExtendWith(MockitoExtension.class)
class CallSessionServiceTest {

	private static final long CALL_SESSION_ID = 1L;
	private static final long CARE_RECEIVER_MEMBER_ID = 2L;
	private static final String OPEN_AI_CALL_ID = "call_123";

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
	private TransactionTemplate transactionTemplate;

	@Mock
	private CallSession callSession;

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
			transactionTemplate
		);
		when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			TransactionCallback<?> callback = invocation.getArgument(0);
			return callback.doInTransaction(null);
		});
		when(callActorResolver.resolve()).thenReturn(new CallActor(CARE_RECEIVER_MEMBER_ID));
		when(callSessionRepository.findForUpdate(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(callSession));
		when(callSession.getId()).thenReturn(CALL_SESSION_ID);
		when(sidebandSessionManager.close(CALL_SESSION_ID)).thenReturn(OPEN_AI_CALL_ID);
	}

	@Test
	void endsCallByUserRequest() {
		callSessionService.end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED);

		verify(callSession).endByUser(any(Instant.class));
		verify(callSession, never()).markUnexpectedDisconnect(any(Instant.class));
		verify(realtimeGateway).hangUp(OPEN_AI_CALL_ID);
	}

	@Test
	void marksConnectionLostAsUnexpectedDisconnect() {
		callSessionService.end(CALL_SESSION_ID, CallTerminationType.CONNECTION_LOST);

		verify(callSession).markUnexpectedDisconnect(any(Instant.class));
		verify(callSession, never()).endByUser(any(Instant.class));
		verify(realtimeGateway).hangUp(OPEN_AI_CALL_ID);
	}
}
