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
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

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
			.andExpect(jsonPath("$.error").value((Object) null));
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
			.andExpect(jsonPath("$.data").value((Object) null))
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIdCheckRejectsLoginIdLongerThanFifteenCharacters() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", "sixteencharacter"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIdCheckRejectsLoginIdContainingWhitespace() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", " testuser"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIdCheckRejectsMissingLoginIdParameter() throws Exception {
		mockMvc.perform(get("/auth/login-id/check"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupCreatesAccountAndStoresHashedPasswordOnly() throws Exception {
		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
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
			.andExpect(jsonPath("$.error.code").value("LOGIN_ID_DUPLICATED"));

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
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));

		assertThat(userRepository.count()).isZero();
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
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsLoginIdContainingWhitespace() throws Exception {
		String body = SIGNUP_BODY.replace("\"testuser\"", "\" testuser\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));

		assertThat(userRepository.count()).isZero();
	}

	@Test
	void signupRejectsLoginIdLongerThanFifteenCharacters() throws Exception {
		String body = SIGNUP_BODY.replace("\"testuser\"", "\"sixteencharacter\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsSingleCharacterName() throws Exception {
		String body = SIGNUP_BODY.replace("\"이경호\"", "\"이\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void signupRejectsFutureBirthDate() throws Exception {
		String body = SIGNUP_BODY.replace("\"1995-03-17\"", "\"2999-01-01\"");

		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
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
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginRejectsBlankPassword() throws Exception {
		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody("")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
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
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginRejectsMalformedJson() throws Exception {
		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	@Test
	void loginIssuesAccessAndRefreshTokens() throws Exception {
		signup();

		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(PASSWORD)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
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
			.andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void loginRejectsUnknownLoginId() throws Exception {
		mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(PASSWORD)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void loginStoresRefreshTokenWithConfiguredExpiry() throws Exception {
		signup();
		String refreshToken = login();

		Long remainingSeconds = redisTemplate.getExpire("auth:refresh:" + refreshToken);

		assertThat(remainingSeconds).isNotNull();
		assertThat(Duration.ofSeconds(remainingSeconds))
			.isBetween(Duration.ofDays(14).minusMinutes(1), Duration.ofDays(14));
	}

	@Test
	void logoutRemovesStoredRefreshToken() throws Exception {
		signup();
		String refreshToken = login();

		mockMvc.perform(post("/auth/logout").contentType(MediaType.APPLICATION_JSON).content(logoutBody(refreshToken)))
			.andExpect(status().isNoContent());

		assertThat(redisTemplate.hasKey("auth:refresh:" + refreshToken)).isFalse();
	}

	@Test
	void logoutRevokesRefreshTokenOnce() throws Exception {
		signup();
		String refreshToken = login();

		mockMvc.perform(post("/auth/logout").contentType(MediaType.APPLICATION_JSON).content(logoutBody(refreshToken)))
			.andExpect(status().isNoContent())
			.andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEmpty());

		mockMvc.perform(post("/auth/logout").contentType(MediaType.APPLICATION_JSON).content(logoutBody(refreshToken)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
	}

	@Test
	void logoutRejectsUnknownRefreshToken() throws Exception {
		mockMvc.perform(post("/auth/logout").contentType(MediaType.APPLICATION_JSON).content(logoutBody("not-issued")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
	}

	@Test
	void logoutRejectsBlankRefreshToken() throws Exception {
		mockMvc.perform(post("/auth/logout").contentType(MediaType.APPLICATION_JSON).content(logoutBody("")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
	}

	private void signup() throws Exception {
		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(SIGNUP_BODY))
			.andExpect(status().isCreated());
	}

	private String login() throws Exception {
		MvcResult result = mockMvc.perform(
				post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(loginBody(PASSWORD)))
			.andExpect(status().isOk())
			.andReturn();

		return readJson(result).path("data").path("refreshToken").asText();
	}

	private JsonNode readJson(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private String loginBody(String password) {
		return """
			{
			  "loginId": "%s",
			  "password": "%s"
			}
			""".formatted(LOGIN_ID, password);
	}

	private String logoutBody(String refreshToken) {
		return """
			{
			  "refreshToken": "%s"
			}
			""".formatted(refreshToken);
	}
}
