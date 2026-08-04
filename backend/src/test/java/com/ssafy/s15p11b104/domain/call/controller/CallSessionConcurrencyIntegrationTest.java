package com.ssafy.s15p11b104.domain.call.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.service.CallActor;
import com.ssafy.s15p11b104.domain.call.service.CallActorResolver;
import com.ssafy.s15p11b104.domain.call.service.CallSessionLeaseService;
import com.ssafy.s15p11b104.domain.call.service.OpenAiCall;
import com.ssafy.s15p11b104.domain.call.service.OpenAiRealtimeGateway;
import com.ssafy.s15p11b104.domain.call.service.SidebandSessionManager;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

@AutoConfigureMockMvc
class CallSessionConcurrencyIntegrationTest extends IntegrationTest {

	private static final String INVITE_CODE = "CONCUR";
	private static final String LOGIN_ID = "concurrent_user";
	private static final String OPEN_AI_CALL_ID = "call_concurrent";
	private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private CallSessionLeaseService callSessionLeaseService;

	@MockitoBean
	private CallActorResolver callActorResolver;

	@MockitoBean
	private OpenAiRealtimeGateway realtimeGateway;

	@MockitoBean
	private SidebandSessionManager sidebandSessionManager;

	private Long careReceiverMemberId;
	private Long groupId;
	private Long userId;

	@BeforeEach
	void setUp() {
		cleanFixture();
		groupId = insertGroup();
		userId = insertUser();
		careReceiverMemberId = insertCareReceiver(groupId, userId);

		when(callActorResolver.resolve()).thenReturn(new CallActor(careReceiverMemberId));
		when(realtimeGateway.createCall(anyString(), any(), anyString(), eq(careReceiverMemberId)))
			.thenReturn(new OpenAiCall(OPEN_AI_CALL_ID, "v=0\r\nmock-answer"));
		when(sidebandSessionManager.activeSessionIds()).thenReturn(Set.of());
	}

	@AfterEach
	void tearDown() {
		cleanFixture();
	}

	@Test
	void concurrentCreateRequestsAllowOnlyOneActiveCall() throws Exception {
		CountDownLatch requestsReady = new CountDownLatch(2);
		CountDownLatch startRequests = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);
		Callable<MvcResult> request = () -> {
			requestsReady.countDown();
			if (!startRequests.await(REQUEST_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
				throw new IllegalStateException("동시 요청 시작 신호를 기다리는 시간이 초과되었습니다.");
			}
			return performCreateRequest();
		};

		Future<MvcResult> firstRequest = executor.submit(request);
		Future<MvcResult> secondRequest = executor.submit(request);

		try {
			assertThat(requestsReady.await(REQUEST_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)).isTrue();
			startRequests.countDown();

			MvcResult firstResult = firstRequest.get(REQUEST_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
			MvcResult secondResult = secondRequest.get(REQUEST_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);

			assertResults(firstResult, secondResult);
		} finally {
			startRequests.countDown();
			executor.shutdownNow();
			assertThat(executor.awaitTermination(REQUEST_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)).isTrue();
		}
	}

	@Test
	void expiredConnectingSessionIsRecoveredBeforeNewCallCreation() throws Exception {
		Long expiredSessionId = insertExpiredCallSession("CONNECTING");

		MvcResult result = performCreateRequest();

		assertThat(result.getResponse().getStatus()).isEqualTo(201);
		assertThat(statusOf(expiredSessionId)).isEqualTo("FAILED");
		assertThat(endedAtOf(expiredSessionId)).isNotNull();
		assertThat(countActiveSessions()).isEqualTo(1);
	}

	@Test
	void expiredInProgressSessionIsRecoveredAsIncomplete() {
		Long expiredSessionId = insertExpiredCallSession("IN_PROGRESS");

		callSessionLeaseService.recoverExpired(Instant.now());

		assertThat(statusOf(expiredSessionId)).isEqualTo("INCOMPLETE");
		assertThat(endedAtOf(expiredSessionId)).isNotNull();
		assertThat(countActiveSessions()).isZero();
	}

	@Test
	void lateConnectedResultCannotReviveExpiredConnectingSession() throws Exception {
		Long expiredSessionId = insertExpiredCallSession("CONNECTING");
		SidebandSessionManager.ClosingSideband closingSideband =
			mock(SidebandSessionManager.ClosingSideband.class);
		when(closingSideband.callId()).thenReturn(OPEN_AI_CALL_ID);
		when(sidebandSessionManager.claimClose(expiredSessionId)).thenReturn(closingSideband);

		MvcResult result = performConnectedResultRequest(expiredSessionId);

		assertThat(result.getResponse().getStatus()).isEqualTo(409);
		JsonNode responseBody = objectMapper.readTree(result.getResponse().getContentAsString());
		assertThat(responseBody.at("/error/code").asText()).isEqualTo("INVALID_CALL_STATUS");
		assertThat(statusOf(expiredSessionId)).isEqualTo("FAILED");
		assertThat(endedAtOf(expiredSessionId)).isNotNull();
		verify(sidebandSessionManager).claimClose(expiredSessionId);
		verify(realtimeGateway).hangUp(OPEN_AI_CALL_ID);
		verify(closingSideband).finishClose();
	}

	@Test
	void lateUserEndPreservesRecoveredIncompleteStatus() throws Exception {
		Long expiredSessionId = insertExpiredCallSession("IN_PROGRESS");

		MvcResult result = performEndRequest(expiredSessionId);

		assertThat(result.getResponse().getStatus()).isEqualTo(202);
		assertThat(statusOf(expiredSessionId)).isEqualTo("INCOMPLETE");
		assertThat(endedAtOf(expiredSessionId)).isNotNull();
	}

	private MvcResult performCreateRequest() throws Exception {
		return mockMvc.perform(post("/call-sessions")
				.with(authenticatedAs(userId))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "persona_id": 1,
					  "sdp_offer": "v=0\\r\\nmock-offer"
					}
					"""))
			.andReturn();
	}

	private MvcResult performConnectedResultRequest(Long callSessionId) throws Exception {
		return mockMvc.perform(post("/call-sessions/{callSessionId}/connection-result", callSessionId)
				.with(authenticatedAs(userId))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"result\":\"CONNECTED\"}"))
			.andReturn();
	}

	private MvcResult performEndRequest(Long callSessionId) throws Exception {
		return mockMvc.perform(post("/call-sessions/{callSessionId}/end", callSessionId)
				.with(authenticatedAs(userId))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"termination_type\":\"USER_REQUESTED\"}"))
			.andReturn();
	}

	private void assertResults(MvcResult firstResult, MvcResult secondResult) throws Exception {
		assertThat(List.of(
			firstResult.getResponse().getStatus(),
			secondResult.getResponse().getStatus()
		)).containsExactlyInAnyOrder(201, 409);

		MvcResult conflictResult = firstResult.getResponse().getStatus() == 409 ? firstResult : secondResult;
		JsonNode conflictBody = objectMapper.readTree(conflictResult.getResponse().getContentAsString());
		assertThat(conflictBody.at("/error/code").asText()).isEqualTo("ACTIVE_CALL_EXISTS");

		assertThat(countActiveSessions()).isEqualTo(1);
		verify(realtimeGateway, times(1)).createCall(
			anyString(),
			any(),
			anyString(),
			eq(careReceiverMemberId)
		);
		verify(sidebandSessionManager, times(1)).connect(
			anyLong(),
			eq(OPEN_AI_CALL_ID),
			any(),
			any()
		);
	}

	private RequestPostProcessor authenticatedAs(Long authenticatedUserId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(authenticatedUserId, "test-access-token"),
			null,
			List.of()
		));
	}

	private Long insertGroup() {
		return jdbcTemplate.queryForObject("""
			insert into family_groups (name, invite_code)
			values ('동시성그룹', ?)
			returning id
			""", Long.class, INVITE_CODE);
	}

	private Long insertUser() {
		return jdbcTemplate.queryForObject("""
			insert into users (login_id, password_hash, name, birth_date, gender)
			values (?, 'unused', '동시성사용자', date '1950-01-01', 'FEMALE')
			returning id
			""", Long.class, LOGIN_ID);
	}

	private Long insertCareReceiver(Long groupId, Long createdUserId) {
		return jdbcTemplate.queryForObject("""
			insert into group_members (group_id, user_id, role, is_manager, joined_at)
			values (?, ?, 'CARE_RECEIVER', false, current_timestamp)
			returning id
			""", Long.class, groupId, createdUserId);
	}

	private Long insertExpiredCallSession(String status) {
		return jdbcTemplate.queryForObject("""
			insert into call_sessions (
				group_id,
				care_receiver_member_id,
				persona_id,
				status,
				started_at,
				lease_expires_at
			)
			values (
				?,
				?,
				1,
				cast(? as call_status),
				case when ? = 'IN_PROGRESS' then current_timestamp - interval '10 minutes' end,
				current_timestamp - interval '1 second'
			)
			returning id
			""", Long.class, groupId, careReceiverMemberId, status, status);
	}

	private String statusOf(Long callSessionId) {
		return jdbcTemplate.queryForObject(
			"select status::text from call_sessions where id = ?",
			String.class,
			callSessionId
		);
	}

	private Instant endedAtOf(Long callSessionId) {
		return jdbcTemplate.queryForObject(
			"select ended_at from call_sessions where id = ?",
			Instant.class,
			callSessionId
		);
	}

	private int countActiveSessions() {
		return jdbcTemplate.queryForObject("""
			select count(*)
			from call_sessions
			where care_receiver_member_id = ?
				and status in ('CONNECTING', 'IN_PROGRESS')
			""", Integer.class, careReceiverMemberId);
	}

	private void cleanFixture() {
		jdbcTemplate.update("""
			delete from call_reports
			where call_session_id in (
				select session.id
				from call_sessions session
				join family_groups family on family.id = session.group_id
				where family.invite_code = ?
			)
			""", INVITE_CODE);
		jdbcTemplate.update("""
			delete from call_transcripts
			where call_session_id in (
				select session.id
				from call_sessions session
				join family_groups family on family.id = session.group_id
				where family.invite_code = ?
			)
			""", INVITE_CODE);
		jdbcTemplate.update("""
			delete from call_sessions
			where group_id in (
				select id
				from family_groups
				where invite_code = ?
			)
			""", INVITE_CODE);
		jdbcTemplate.update("""
			delete from group_members
			where group_id in (
				select id
				from family_groups
				where invite_code = ?
			)
			""", INVITE_CODE);
		jdbcTemplate.update("delete from users where login_id = ?", LOGIN_ID);
		jdbcTemplate.update("delete from family_groups where invite_code = ?", INVITE_CODE);
	}
}
