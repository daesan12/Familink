package com.ssafy.s15p11b104.domain.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.support.IntegrationTest;

@AutoConfigureMockMvc
class AuthApiTest extends IntegrationTest {

	private static final String LOGIN_ID = "testuser";
	private static final String PASSWORD = "password123";
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
	private PasswordEncoder passwordEncoder;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@BeforeEach
	void resetState() {
		userRepository.deleteAll();
		try (RedisConnection connection = redisTemplate.getRequiredConnectionFactory().getConnection()) {
			connection.serverCommands().flushDb();
		}
	}

	@Test
	void loginIdCheckReportsUnusedLoginIdAsAvailable() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", LOGIN_ID))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.available").value(true))
			.andExpect(jsonPath("$.message").value("로그인 아이디 중복 확인 성공"));
	}

	@Test
	void loginIdCheckReportsRegisteredLoginIdAsUnavailable() throws Exception {
		signup();

		mockMvc.perform(get("/auth/login-id/check").param("loginId", LOGIN_ID))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.available").value(false));
	}

	@Test
	void loginIdCheckRejectsLoginIdShorterThanFiveCharacters() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", "abcd"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.errors").isArray())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIdCheckRejectsLoginIdLongerThanFifteenCharacters() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", "sixteencharacter"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIdCheckRejectsLoginIdContainingWhitespace() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", " testuser"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIdCheckRejectsMissingLoginIdParameter() throws Exception {
		mockMvc.perform(get("/auth/login-id/check"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupCreatesAccountAndStoresHashedPasswordOnly() throws Exception {
		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.message").value("회원가입 성공"))
			.andExpect(jsonPath("$.data.userId").isNumber())
			.andExpect(jsonPath("$.data.loginId").value(LOGIN_ID))
			.andExpect(jsonPath("$.data.name").value("이경호"))
			.andExpect(jsonPath("$.data.createdAt").isString());

		User saved = userRepository.findByLoginIdAndWithdrawnAtIsNull(LOGIN_ID).orElseThrow();
		assertThat(saved.getPasswordHash()).isNotEqualTo(PASSWORD);
		assertThat(passwordEncoder.matches(PASSWORD, saved.getPasswordHash())).isTrue();
		assertThat(saved.getWithdrawnAt()).isNull();
	}

	@Test
	void signupReturnsCreatedAtAsIsoInstant() throws Exception {
		MvcResult result = mockMvc.perform(
				post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isCreated())
			.andReturn();

		String createdAt = readJson(result).path("data").path("createdAt").asText();

		assertThat(Instant.parse(createdAt)).isNotNull();
	}

	@Test
	void signupRejectsDuplicatedLoginId() throws Exception {
		signup();

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("LOGIN_ID_DUPLICATED"));

		assertThat(userRepository.count()).isEqualTo(1);
	}

	@Test
	void signupRejectsPasswordShorterThanEightCharacters() throws Exception {
		String body = """
			{
			  "loginId": "testuser",
			  "password": "short",
			  "name": "이경호",
			  "birthDate": "1995-03-17",
			  "gender": "MALE"
			}
			""";

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		assertThat(userRepository.count()).isZero();
	}

	@Test
	void signupReportsFailedFieldsInErrors() throws Exception {
		String body = SIGNUP_BODY.replace("\"password123\"", "\"short\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.message").value("요청 형식 또는 검증 실패"))
			.andExpect(jsonPath("$.errors").isArray())
			.andExpect(jsonPath("$.errors[0].field").value("password"))
			.andExpect(jsonPath("$.errors[0].message").isString());
	}

	@Test
	void signupRejectsUnknownGender() throws Exception {
		String body = """
			{
			  "loginId": "testuser",
			  "password": "password123",
			  "name": "이경호",
			  "birthDate": "1995-03-17",
			  "gender": "UNKNOWN"
			}
			""";

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsLoginIdContainingWhitespace() throws Exception {
		String body = SIGNUP_BODY.replace("\"testuser\"", "\" testuser\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		assertThat(userRepository.count()).isZero();
	}

	@Test
	void signupRejectsLoginIdLongerThanFifteenCharacters() throws Exception {
		String body = SIGNUP_BODY.replace("\"testuser\"", "\"sixteencharacter\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsSingleCharacterName() throws Exception {
		String body = SIGNUP_BODY.replace("\"이경호\"", "\"이\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsFutureBirthDate() throws Exception {
		String body = SIGNUP_BODY.replace("\"1995-03-17\"", "\"2999-01-01\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsMissingBirthDate() throws Exception {
		String body = """
			{
			  "loginId": "testuser",
			  "password": "password123",
			  "name": "이경호",
			  "gender": "MALE"
			}
			""";

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginRejectsBlankPassword() throws Exception {
		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody("")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginRejectsBlankLoginId() throws Exception {
		String body = """
			{
			  "loginId": "",
			  "password": "password123"
			}
			""";

		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginRejectsMalformedJson() throws Exception {
		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIssuesAccessAndRefreshTokens() throws Exception {
		signup();

		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(PASSWORD)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.message").value("로그인 성공"))
			.andExpect(jsonPath("$.data.tokenType").value("Bearer"))
			.andExpect(jsonPath("$.data.accessToken").isString())
			.andExpect(jsonPath("$.data.accessTokenExpiresIn").value(1800))
			.andExpect(jsonPath("$.data.refreshToken").isString())
			.andExpect(jsonPath("$.data.user.id").isNumber())
			.andExpect(jsonPath("$.data.user.name").value("이경호"));
	}

	@Test
	void loginRejectsWrongPassword() throws Exception {
		signup();

		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody("wrongpassword")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void loginRejectsUnknownLoginId() throws Exception {
		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(PASSWORD)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void loginStoresRefreshTokenWithConfiguredExpiry() throws Exception {
		signup();
		Session session = login();

		Long remainingSeconds = redisTemplate.getExpire("refresh:" + session.userId());

		assertThat(remainingSeconds).isNotNull();
		assertThat(Duration.ofSeconds(remainingSeconds))
			.isBetween(Duration.ofDays(14).minusMinutes(1), Duration.ofDays(14));
	}

	@Test
	void secondLoginReplacesStoredRefreshToken() throws Exception {
		signup();
		Session first = login();
		Session second = login();

		assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());
		assertThat(redisTemplate.opsForValue().get("refresh:" + first.userId()))
			.isEqualTo(second.refreshToken());

		reissue(first.refreshToken())
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
	}

	@Test
	void reissueIssuesNewTokenPairWithoutAccessToken() throws Exception {
		signup();
		Session session = login();

		MvcResult result = reissue(session.refreshToken())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.message").value("토큰 재발급 성공"))
			.andExpect(jsonPath("$.data.tokenType").value("Bearer"))
			.andExpect(jsonPath("$.data.accessToken").isString())
			.andExpect(jsonPath("$.data.accessTokenExpiresIn").value(1800))
			.andExpect(jsonPath("$.data.refreshToken").isString())
			.andReturn();

		assertThat(readJson(result).path("data").path("refreshToken").asText())
			.isNotEqualTo(session.refreshToken());
	}

	@Test
	void reissueRotatesRefreshTokenSoTheOldOneIsRejected() throws Exception {
		signup();
		Session session = login();

		reissue(session.refreshToken()).andExpect(status().isOk());

		reissue(session.refreshToken())
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"))
			.andExpect(jsonPath("$.message").value("Refresh Token 만료·위조·폐기"))
			.andExpect(jsonPath("$.errors").isArray());
	}

	@Test
	void reissuedAccessTokenAuthenticatesProtectedRequest() throws Exception {
		signup();
		Session session = login();

		MvcResult result = reissue(session.refreshToken()).andExpect(status().isOk()).andReturn();
		JsonNode data = readJson(result).path("data");

		logout(data.path("accessToken").asText(), data.path("refreshToken").asText())
			.andExpect(status().isNoContent());
	}

	@Test
	void reissuedRefreshTokenCanBeRotatedAgain() throws Exception {
		signup();
		Session session = login();

		MvcResult result = reissue(session.refreshToken()).andExpect(status().isOk()).andReturn();
		String rotatedToken = readJson(result).path("data").path("refreshToken").asText();

		reissue(rotatedToken).andExpect(status().isOk());
	}

	@Test
	void reissueRejectsUnknownRefreshToken() throws Exception {
		reissue("not-a-token")
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
	}

	@Test
	void reissueRejectsAccessTokenUsedAsRefreshToken() throws Exception {
		signup();
		Session session = login();

		reissue(session.accessToken())
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
	}

	@Test
	void reissueRejectsBlankRefreshToken() throws Exception {
		reissue("")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void logoutRevokesRefreshTokenAndBlacklistsAccessToken() throws Exception {
		signup();
		Session session = login();

		logout(session.accessToken(), session.refreshToken())
			.andExpect(status().isNoContent())
			.andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEmpty());

		assertThat(redisTemplate.hasKey("refresh:" + session.userId())).isFalse();
		assertThat(redisTemplate.hasKey("blacklist:" + session.accessToken())).isTrue();

		reissue(session.refreshToken())
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_REFRESH_TOKEN"));
	}

	@Test
	void blacklistedAccessTokenIsRejected() throws Exception {
		signup();
		Session session = login();

		logout(session.accessToken(), session.refreshToken()).andExpect(status().isNoContent());

		logout(session.accessToken(), session.refreshToken())
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}

	@Test
	void logoutWithRotatedRefreshTokenKeepsTheActiveSession() throws Exception {
		signup();
		Session stale = login();
		Session active = login();

		logout(stale.accessToken(), stale.refreshToken())
			.andExpect(status().isNoContent());

		assertThat(redisTemplate.opsForValue().get("refresh:" + active.userId()))
			.isEqualTo(active.refreshToken());
		reissue(active.refreshToken()).andExpect(status().isOk());
	}

	@Test
	void logoutBlacklistsAccessTokenForItsRemainingValidity() throws Exception {
		signup();
		Session session = login();

		logout(session.accessToken(), session.refreshToken()).andExpect(status().isNoContent());

		Long remainingSeconds = redisTemplate.getExpire("blacklist:" + session.accessToken());
		assertThat(remainingSeconds).isNotNull();
		assertThat(Duration.ofSeconds(remainingSeconds))
			.isPositive()
			.isLessThanOrEqualTo(Duration.ofMinutes(30));
	}

	@Test
	void logoutRequiresAccessToken() throws Exception {
		signup();
		Session session = login();

		mockMvc.perform(post("/auth/logout")
				.contentType(MediaType.APPLICATION_JSON)
				.content(refreshTokenBody(session.refreshToken())))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.message").value("Access Token 없음·만료·위조"))
			.andExpect(jsonPath("$.errors").isArray());
	}

	@Test
	void refreshTokenIsRejectedAsAccessToken() throws Exception {
		signup();
		Session session = login();

		logout(session.refreshToken(), session.refreshToken())
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}

	@Test
	void logoutRejectsRefreshTokenOfAnotherUser() throws Exception {
		signup();
		Session owner = login();
		Session other = signupAndLoginOtherUser();

		logout(other.accessToken(), owner.refreshToken())
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("FORBIDDEN"))
			.andExpect(jsonPath("$.message").value("역할 또는 리소스 접근 권한 부족"));

		assertThat(redisTemplate.hasKey("refresh:" + owner.userId())).isTrue();
	}

	@Test
	void logoutRejectsUnparseableRefreshToken() throws Exception {
		signup();
		Session session = login();

		logout(session.accessToken(), "not-a-token")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void logoutRejectsBlankRefreshToken() throws Exception {
		signup();
		Session session = login();

		logout(session.accessToken(), "")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	private void signup() throws Exception {
		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isCreated());
	}

	private Session login() throws Exception {
		return login(LOGIN_ID, PASSWORD);
	}

	private Session login(String loginId, String password) throws Exception {
		MvcResult result = mockMvc.perform(post("/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(loginBody(loginId, password)))
			.andExpect(status().isOk())
			.andReturn();

		JsonNode data = readJson(result).path("data");
		return new Session(
			data.path("user").path("id").asLong(),
			data.path("accessToken").asText(),
			data.path("refreshToken").asText());
	}

	private Session signupAndLoginOtherUser() throws Exception {
		String body = SIGNUP_BODY
			.replace("\"testuser\"", "\"otheruser\"")
			.replace("\"이경호\"", "\"김영하\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isCreated());

		return login("otheruser", PASSWORD);
	}

	private ResultActions reissue(String refreshToken) throws Exception {
		return mockMvc.perform(post("/auth/reissue")
			.contentType(MediaType.APPLICATION_JSON)
			.content(refreshTokenBody(refreshToken)));
	}

	private ResultActions logout(String accessToken, String refreshToken) throws Exception {
		return mockMvc.perform(post("/auth/logout")
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
			.contentType(MediaType.APPLICATION_JSON)
			.content(refreshTokenBody(refreshToken)));
	}

	private JsonNode readJson(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private String loginBody(String password) {
		return loginBody(LOGIN_ID, password);
	}

	private String loginBody(String loginId, String password) {
		return """
			{
			  "loginId": "%s",
			  "password": "%s"
			}
			""".formatted(loginId, password);
	}

	private String refreshTokenBody(String refreshToken) {
		return """
			{
			  "refreshToken": "%s"
			}
			""".formatted(refreshToken);
	}

	private record Session(Long userId, String accessToken, String refreshToken) {
	}
}
