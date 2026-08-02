package com.ssafy.s15p11b104.domain.call.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.ssafy.s15p11b104.domain.call.service.OpenAiCall;
import com.ssafy.s15p11b104.domain.call.service.OpenAiRealtimeGateway;
import com.ssafy.s15p11b104.domain.call.service.SidebandSessionManager;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

/**
 * 운영 프로필 경로의 {@code JwtCallActorResolver}가 인증 사용자를 피보호자 멤버십으로
 * 해석하는지 API 경계에서 검증한다. {@code CallActorResolver}를 모킹하지 않는다.
 */
@AutoConfigureMockMvc
class JwtCallActorResolverIntegrationTest extends IntegrationTest {

	private static final String INVITE_CODE = "JWTACT";
	private static final String SECOND_INVITE_CODE = "JWTGRD";
	private static final String CARE_RECEIVER_LOGIN_ID = "jwt_care_recv";
	private static final String GUARDIAN_LOGIN_ID = "jwt_guardian";
	private static final String LEFT_LOGIN_ID = "jwt_left_member";
	private static final String CREATE_REQUEST_BODY = """
		{
		  "persona_id": 1,
		  "sdp_offer": "v=0\\r\\nmock-offer"
		}
		""";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@MockitoBean
	private OpenAiRealtimeGateway realtimeGateway;

	@MockitoBean
	private SidebandSessionManager sidebandSessionManager;

	private Long careReceiverUserId;
	private Long careReceiverMemberId;
	private Long guardianUserId;
	private Long leftMemberUserId;

	@BeforeEach
	void setUp() {
		cleanFixture();
		Long groupId = insertGroup(INVITE_CODE);
		careReceiverUserId = insertUser(CARE_RECEIVER_LOGIN_ID);
		guardianUserId = insertUser(GUARDIAN_LOGIN_ID);
		leftMemberUserId = insertUser(LEFT_LOGIN_ID);
		careReceiverMemberId = insertMember(groupId, careReceiverUserId, "CARE_RECEIVER", false);
		insertMember(groupId, guardianUserId, "GUARDIAN", true);
		insertLeftCareReceiver(groupId, leftMemberUserId);

		when(realtimeGateway.createCall(anyString(), any(), anyString(), anyLong()))
			.thenReturn(new OpenAiCall("call_jwt_actor", "v=0\r\nmock-answer"));
	}

	@AfterEach
	void tearDown() {
		cleanFixture();
	}

	@Test
	void createsCallSessionForAuthenticatedCareReceiver() throws Exception {
		mockMvc.perform(post("/call-sessions")
				.with(authenticatedAs(careReceiverUserId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(CREATE_REQUEST_BODY))
			.andExpect(status().isCreated());
	}

	@Test
	void resolvesCareReceiverMembershipWhenUserIsAlsoGuardianInAnotherGroup() throws Exception {
		Long secondGroupId = insertGroup(SECOND_INVITE_CODE);
		insertMember(secondGroupId, careReceiverUserId, "GUARDIAN", true);

		mockMvc.perform(post("/call-sessions")
				.with(authenticatedAs(careReceiverUserId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(CREATE_REQUEST_BODY))
			.andExpect(status().isCreated());

		Long sessionMemberId = jdbcTemplate.queryForObject("""
			select care_receiver_member_id
			from call_sessions
			where group_id in (select id from family_groups where invite_code in (?, ?))
			""", Long.class, INVITE_CODE, SECOND_INVITE_CODE);
		assertThat(sessionMemberId).isEqualTo(careReceiverMemberId);
	}

	@Test
	void rejectsGuardianAsForbidden() throws Exception {
		mockMvc.perform(post("/call-sessions")
				.with(authenticatedAs(guardianUserId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(CREATE_REQUEST_BODY))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
	}

	@Test
	void rejectsLeftCareReceiverAsForbidden() throws Exception {
		mockMvc.perform(post("/call-sessions")
				.with(authenticatedAs(leftMemberUserId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(CREATE_REQUEST_BODY))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
	}

	@Test
	void rejectsMissingAccessTokenAsUnauthorized() throws Exception {
		mockMvc.perform(post("/call-sessions")
				.contentType(MediaType.APPLICATION_JSON)
				.content(CREATE_REQUEST_BODY))
			.andExpect(status().isUnauthorized());
	}

	private RequestPostProcessor authenticatedAs(Long authenticatedUserId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(authenticatedUserId, "test-access-token"),
			null,
			List.of()
		));
	}

	private Long insertGroup(String inviteCode) {
		return jdbcTemplate.queryForObject("""
			insert into family_groups (name, invite_code)
			values ('JWT통화그룹', ?)
			returning id
			""", Long.class, inviteCode);
	}

	private Long insertUser(String loginId) {
		return jdbcTemplate.queryForObject("""
			insert into users (login_id, password_hash, name, birth_date, gender)
			values (?, 'unused', 'JWT사용자', date '1950-01-01', 'FEMALE')
			returning id
			""", Long.class, loginId);
	}

	private Long insertMember(Long groupId, Long userId, String role, boolean isManager) {
		return jdbcTemplate.queryForObject("""
			insert into group_members (group_id, user_id, role, is_manager, joined_at)
			values (?, ?, ?::group_role, ?, current_timestamp)
			returning id
			""", Long.class, groupId, userId, role, isManager);
	}

	private void insertLeftCareReceiver(Long groupId, Long userId) {
		jdbcTemplate.update("""
			insert into group_members (group_id, user_id, role, is_manager, joined_at, left_at)
			values (?, ?, 'CARE_RECEIVER', false, current_timestamp, current_timestamp)
			""", groupId, userId);
	}

	private void cleanFixture() {
		jdbcTemplate.update("""
			delete from call_sessions
			where group_id in (
				select id
				from family_groups
				where invite_code in (?, ?)
			)
			""", INVITE_CODE, SECOND_INVITE_CODE);
		jdbcTemplate.update("""
			delete from group_members
			where group_id in (
				select id
				from family_groups
				where invite_code in (?, ?)
			)
			""", INVITE_CODE, SECOND_INVITE_CODE);
		jdbcTemplate.update(
			"delete from users where login_id in (?, ?, ?)",
			CARE_RECEIVER_LOGIN_ID,
			GUARDIAN_LOGIN_ID,
			LEFT_LOGIN_ID
		);
		jdbcTemplate.update(
			"delete from family_groups where invite_code in (?, ?)",
			INVITE_CODE,
			SECOND_INVITE_CODE
		);
	}
}
