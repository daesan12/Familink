package com.ssafy.s15p11b104.domain.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRepository;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

/**
 * 본인 프로필 조회·수정과 회원 탈퇴 API를 검증한다.
 *
 * <p>실제 로그인으로 받은 Access Token을 헤더에 실어 인증 필터를 함께 통과시킨다. 인증 주체를 직접
 * 주입하면 필터가 넣는 주체 타입과 컨트롤러가 받는 타입이 어긋나도 테스트가 통과하기 때문이다.
 */
@AutoConfigureMockMvc
class UserApiTest extends IntegrationTest {

	private static final String PATH = "/users/me";
	private static final String LOGIN_ID = "testuser";
	private static final String PASSWORD = "password123";
	private static final String PROFILE_IMAGE_URL = "https://cdn/profile-image/profile.png";
	private static final String PROFILE_IMAGE_JSON = "\"" + PROFILE_IMAGE_URL + "\"";
	private static final String SIGNUP_BODY = """
		{
		  "loginId": "testuser",
		  "password": "password123",
		  "name": "이경호",
		  "birthDate": "1995-03-17",
		  "gender": "MALE"
		}
		""";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private DeviceTokenRepository deviceTokenRepository;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@MockitoBean
	private S3Client s3Client;

	@BeforeEach
	void resetState() {
		clearDatabase();
		try (RedisConnection connection = redisTemplate.getRequiredConnectionFactory().getConnection()) {
			connection.serverCommands().flushDb();
		}
		when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(validImageMetadata());
	}

	@Test
	void profileReturnsStoredAccountInformation() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(get(PATH), session))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.message").value("내 프로필 조회 성공"))
			.andExpect(jsonPath("$.data.loginId").value(LOGIN_ID))
			.andExpect(jsonPath("$.data.name").value("이경호"))
			.andExpect(jsonPath("$.data.birthDate").value("1995-03-17"))
			.andExpect(jsonPath("$.data.gender").value("MALE"))
			.andExpect(jsonPath("$.data.profileImageUrl").value(nullValue()));
	}

	@Test
	void profileRequiresAuthentication() throws Exception {
		mockMvc.perform(get(PATH))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}

	@Test
	void updateChangesOnlyProvidedFields() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "김영하"
					}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("내 프로필 수정 성공"))
			.andExpect(jsonPath("$.data.id").value(session.userId()))
			.andExpect(jsonPath("$.data.name").value("김영하"))
			.andExpect(jsonPath("$.data.updatedAt").isString());

		User saved = userRepository.findById(session.userId()).orElseThrow();
		assertThat(saved.getName()).isEqualTo("김영하");
		assertThat(saved.getLoginId()).isEqualTo(LOGIN_ID);
		assertThat(saved.getBirthDate()).isEqualTo("1995-03-17");
		assertThat(saved.getGender()).isEqualTo(UserGender.MALE);
	}

	@Test
	void updateAcceptsEveryProfileField() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "loginId": "renamedid",
					  "name": "김영하",
					  "birthDate": "1960-04-21",
					  "gender": "FEMALE",
					  "profileImageUrl": "%s"
					}
					""".formatted(PROFILE_IMAGE_URL)))
			.andExpect(status().isOk());

		User saved = userRepository.findById(session.userId()).orElseThrow();
		assertThat(saved.getLoginId()).isEqualTo("renamedid");
		assertThat(saved.getName()).isEqualTo("김영하");
		assertThat(saved.getBirthDate()).isEqualTo("1960-04-21");
		assertThat(saved.getGender()).isEqualTo(UserGender.FEMALE);
		assertThat(saved.getProfileImageUrl()).isEqualTo(PROFILE_IMAGE_URL);
	}

	@Test
	void updateRejectsExternalAndWrongPurposeProfileImageUrls() throws Exception {
		Session session = signupAndLogin();
		updateProfileImage(session, PROFILE_IMAGE_JSON);
		clearInvocations(s3Client);

		for (String invalidUrl : List.of(
			"https://example.com/profile-image/external.png",
			"https://cdn/post-media/post.png")) {
			mockMvc.perform(authorized(patch(PATH), session)
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
						{
						  "name": "김영하",
						  "profileImageUrl": "%s"
						}
						""".formatted(invalidUrl)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}

		User unchanged = userRepository.findById(session.userId()).orElseThrow();
		assertThat(unchanged.getName()).isEqualTo("이경호");
		assertThat(unchanged.getProfileImageUrl()).isEqualTo(PROFILE_IMAGE_URL);
		verifyNoInteractions(s3Client);
	}

	@Test
	void updateRejectsProfileImageWhenObjectMetadataIsInvalid() throws Exception {
		Session session = signupAndLogin();
		updateProfileImage(session, PROFILE_IMAGE_JSON);
		when(s3Client.headObject(any(HeadObjectRequest.class)))
			.thenReturn(HeadObjectResponse.builder().contentLength(1024L).contentType("image/gif").build());

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "김영하",
					  "profileImageUrl": "https://cdn/profile-image/invalid.gif"
					}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		User unchanged = userRepository.findById(session.userId()).orElseThrow();
		assertThat(unchanged.getName()).isEqualTo("이경호");
		assertThat(unchanged.getProfileImageUrl()).isEqualTo(PROFILE_IMAGE_URL);
	}

	@Test
	void updateKeepsProfileImageWhenFieldIsOmitted() throws Exception {
		Session session = signupAndLogin();
		updateProfileImage(session, PROFILE_IMAGE_JSON);
		clearInvocations(s3Client);

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "name": "김영하"
					}
					"""))
			.andExpect(status().isOk());

		assertThat(userRepository.findById(session.userId()).orElseThrow().getProfileImageUrl())
			.isEqualTo(PROFILE_IMAGE_URL);
		verifyNoInteractions(s3Client);
	}

	@Test
	void updateRemovesProfileImageWhenFieldIsExplicitNull() throws Exception {
		Session session = signupAndLogin();
		updateProfileImage(session, PROFILE_IMAGE_JSON);
		clearInvocations(s3Client);

		updateProfileImage(session, "null");

		assertThat(userRepository.findById(session.userId()).orElseThrow().getProfileImageUrl()).isNull();
		verifyNoInteractions(s3Client);
	}

	@Test
	void updateKeepsProfileImageWhenBlankValueIsRejected() throws Exception {
		Session session = signupAndLogin();
		updateProfileImage(session, PROFILE_IMAGE_JSON);

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"profileImageUrl\": \"\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		assertThat(userRepository.findById(session.userId()).orElseThrow().getProfileImageUrl())
			.isEqualTo(PROFILE_IMAGE_URL);
	}

	@Test
	void updateWithEmptyBodyKeepsProfileUnchanged() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.name").value("이경호"));

		assertThat(userRepository.findById(session.userId()).orElseThrow().getLoginId()).isEqualTo(LOGIN_ID);
	}

	@Test
	void updateToLoginIdUsedByAnotherUserIsRejected() throws Exception {
		Session session = signupAndLogin();
		signupOtherUser();

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "loginId": "otheruser"
					}
					"""))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("LOGIN_ID_DUPLICATED"))
			.andExpect(jsonPath("$.errors").isArray());

		assertThat(userRepository.findById(session.userId()).orElseThrow().getLoginId()).isEqualTo(LOGIN_ID);
	}

	@Test
	void updateToOwnLoginIdSucceeds() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
					  "loginId": "testuser"
					}
					"""))
			.andExpect(status().isOk());

		assertThat(userRepository.findById(session.userId()).orElseThrow().getLoginId()).isEqualTo(LOGIN_ID);
	}

	@Test
	void updateRejectsValuesThatSignupWouldReject() throws Exception {
		Session session = signupAndLogin();

		List<String> invalidBodies = List.of(
			"{\"loginId\": \"abcd\"}",
			"{\"loginId\": \"sixteencharacter\"}",
			"{\"loginId\": \" testuser\"}",
			"{\"loginId\": \"test!\"}",
			"{\"loginId\": \"가나다라마\"}",
			"{\"name\": \"김\"}",
			"{\"name\": \"   \"}",
			"{\"name\": \"가나다라마바사아자차카\"}",
			"{\"birthDate\": \"2999-01-01\"}",
			"{\"gender\": \"UNKNOWN\"}",
			"{\"profileImageUrl\": \"\"}",
			"{\"profileImageUrl\": \"   \"}");

		for (String body : invalidBodies) {
			mockMvc.perform(authorized(patch(PATH), session)
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}

		User unchanged = userRepository.findById(session.userId()).orElseThrow();
		assertThat(unchanged.getLoginId()).isEqualTo(LOGIN_ID);
		assertThat(unchanged.getName()).isEqualTo("이경호");
	}

	@Test
	void updateReportsFieldErrorsForInvalidValues() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"loginId\": \"abcd\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("loginId"))
			.andExpect(jsonPath("$.errors[0].message").isString());
	}

	@Test
	void updateRequiresAuthentication() throws Exception {
		mockMvc.perform(patch(PATH)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"김영하\"}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void withdrawalAnonymizesPersonalInformationAndKeepsTheRow() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent())
			.andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEmpty());

		User withdrawn = userRepository.findById(session.userId()).orElseThrow();
		assertThat(withdrawn.getWithdrawnAt()).isNotNull();
		assertThat(withdrawn.getLoginId()).isNull();
		assertThat(withdrawn.getPasswordHash()).isNull();
		assertThat(withdrawn.getName()).isNull();
		assertThat(withdrawn.getBirthDate()).isNull();
		assertThat(withdrawn.getGender()).isNull();
		assertThat(withdrawn.getProfileImageUrl()).isNull();
	}

	@Test
	void withdrawalBlocksTheAccessTokenUsedForTheRequest() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent());

		mockMvc.perform(authorized(get(PATH), session))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
		assertThat(redisTemplate.hasKey("blacklist:" + session.accessToken())).isTrue();
	}

	@Test
	void withdrawalRevokesTheRefreshToken() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent());

		mockMvc.perform(post("/auth/reissue")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\": \"%s\"}".formatted(session.refreshToken())))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
		assertThat(redisTemplate.hasKey("refresh:" + session.userId())).isFalse();
	}

	@Test
	void withdrawalReleasesTheLoginIdAndBlocksLoginWithTheOldPassword() throws Exception {
		Session session = signupAndLogin();

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent());

		mockMvc.perform(get("/auth/login-id/check").param("loginId", LOGIN_ID))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.available").value(true));
		mockMvc.perform(post("/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"loginId\": \"%s\", \"password\": \"%s\"}".formatted(LOGIN_ID, PASSWORD)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void withdrawalEndsActiveGroupMemberships() throws Exception {
		Session session = signupAndLogin();
		Long memberId = joinGroup(session.userId(), "ABC123", GroupRole.CARE_RECEIVER, false);

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent());

		assertThat(groupMemberRepository.findById(memberId).orElseThrow().getLeftAt()).isNotNull();
		assertThat(groupMemberRepository.findAllActiveByUserId(session.userId())).isEmpty();
	}

	@Test
	void withdrawalDeactivatesEveryOwnedDeviceTokenAndKeepsOtherUsersTokensActive() throws Exception {
		Session session = signupAndLogin();
		signupOtherUser();
		User user = userRepository.findById(session.userId()).orElseThrow();
		User other = userRepository.findByLoginIdAndWithdrawnAtIsNull("otheruser").orElseThrow();
		DeviceToken first = deviceTokenRepository.saveAndFlush(new DeviceToken(user, "first-token", "ANDROID"));
		DeviceToken second = deviceTokenRepository.saveAndFlush(new DeviceToken(user, "second-token", "ANDROID"));
		DeviceToken otherToken = deviceTokenRepository.saveAndFlush(
			new DeviceToken(other, "other-token", "ANDROID"));

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent());

		assertThat(deviceTokenRepository.findById(first.getId()).orElseThrow().isActive()).isFalse();
		assertThat(deviceTokenRepository.findById(second.getId()).orElseThrow().isActive()).isFalse();
		assertThat(deviceTokenRepository.findById(otherToken.getId()).orElseThrow().isActive()).isTrue();
	}

	@Test
	void managerOfAnActiveGroupMustTransferTheRoleBeforeWithdrawal() throws Exception {
		Session session = signupAndLogin();
		Long memberId = joinGroup(session.userId(), "ABC123", GroupRole.GUARDIAN, true);
		DeviceToken token = deviceTokenRepository.saveAndFlush(new DeviceToken(
			userRepository.findById(session.userId()).orElseThrow(),
			"manager-token",
			"ANDROID"));

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("MANAGER_TRANSFER_REQUIRED"))
			.andExpect(jsonPath("$.errors").isArray());

		assertThat(userRepository.findById(session.userId()).orElseThrow().getWithdrawnAt()).isNull();
		assertThat(groupMemberRepository.findById(memberId).orElseThrow().getLeftAt()).isNull();
		assertThat(deviceTokenRepository.findById(token.getId()).orElseThrow().isActive()).isTrue();
		assertThat(redisTemplate.hasKey("refresh:" + session.userId())).isTrue();
	}

	@Test
	void nonManagerMemberOfAnActiveGroupCanWithdraw() throws Exception {
		Session session = signupAndLogin();
		joinGroup(session.userId(), "ABC123", GroupRole.GUARDIAN, false);

		mockMvc.perform(authorized(delete(PATH), session))
			.andExpect(status().isNoContent());

		assertThat(userRepository.findById(session.userId()).orElseThrow().getWithdrawnAt()).isNotNull();
	}

	@Test
	void withdrawalRequiresAuthentication() throws Exception {
		mockMvc.perform(delete(PATH))
			.andExpect(status().isUnauthorized());
	}

	private HeadObjectResponse validImageMetadata() {
		return HeadObjectResponse.builder()
			.contentLength(1024L)
			.contentType("image/png")
			.build();
	}

	private void updateProfileImage(Session session, String jsonValue) throws Exception {
		mockMvc.perform(authorized(patch(PATH), session)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"profileImageUrl\": %s}".formatted(jsonValue)))
			.andExpect(status().isOk());
	}

	private MockHttpServletRequestBuilder authorized(MockHttpServletRequestBuilder builder, Session session) {
		return builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + session.accessToken());
	}

	private Session signupAndLogin() throws Exception {
		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isCreated());

		MvcResult result = mockMvc.perform(post("/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"loginId\": \"%s\", \"password\": \"%s\"}".formatted(LOGIN_ID, PASSWORD)))
			.andExpect(status().isOk())
			.andReturn();

		JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
		return new Session(
			data.path("user").path("id").asLong(),
			data.path("accessToken").asText(),
			data.path("refreshToken").asText());
	}

	private void signupOtherUser() throws Exception {
		String body = SIGNUP_BODY
			.replace("\"testuser\"", "\"otheruser\"")
			.replace("\"이경호\"", "\"김영하\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated());
	}

	private Long joinGroup(Long userId, String inviteCode, GroupRole role, boolean manager) {
		return transactionTemplate.execute(status -> {
			FamilyGroup group = entityManager.merge(new FamilyGroup("가족", inviteCode));
			User user = entityManager.find(User.class, userId);
			GroupMember member = groupMemberRepository.save(
				new GroupMember(group, user, role, manager, Instant.now()));
			entityManager.flush();
			return member.getId();
		});
	}

	private void clearDatabase() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createQuery("delete from DeviceToken").executeUpdate();
			entityManager.createQuery("delete from GroupMember").executeUpdate();
			entityManager.createQuery("delete from FamilyGroup").executeUpdate();
			entityManager.createQuery("delete from User").executeUpdate();
			entityManager.flush();
		});
	}

	private record Session(Long userId, String accessToken, String refreshToken) {
	}
}
