package com.ssafy.s15p11b104.domain.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.domain.file.dto.UploadResponse;
import com.ssafy.s15p11b104.domain.file.service.PresignedUploadProvider;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 탈퇴가 이미 발급된 Access Token까지 끊는지 검증한다.
 *
 * <p>검증에는 업로드 URL 발급 API를 쓴다. 프로필 API는 서비스 계층에서 활성 계정을 다시 조회해
 * 탈퇴자를 막으므로, 인증 필터가 토큰을 통과시켜도 401이 나와 필터의 결함이 드러나지 않는다. 업로드
 * URL 발급은 인증 주체만 신뢰하고 계정 상태를 다시 확인하지 않아, 필터를 통과한 토큰이 그대로
 * 권한으로 이어진다.
 */
@AutoConfigureMockMvc
class WithdrawalTokenRevocationTest extends IntegrationTest {

	private static final Duration ACCESS_TOKEN_VALIDITY = Duration.ofMinutes(30);
	private static final String LOGIN_ID = "withdrawtokens";
	private static final String OTHER_LOGIN_ID = "keeptokens";
	private static final String PASSWORD = "password123";
	private static final String SIGNUP_BODY = """
		{
		  "loginId": "withdrawtokens",
		  "password": "password123",
		  "name": "이경호",
		  "birthDate": "1995-03-17",
		  "gender": "MALE"
		}
		""";
	private static final String OTHER_SIGNUP_BODY = SIGNUP_BODY
		.replace(LOGIN_ID, OTHER_LOGIN_ID)
		.replace("이경호", "김영하");
	private static final String PRESIGNED_URL_BODY = """
		{
		  "purpose": "post-media",
		  "files": [{"fileName": "photo.jpg", "contentType": "image/jpeg", "sizeBytes": 1024}]
		}
		""";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@Autowired
	private EntityManager entityManager;

	@MockitoBean
	private PresignedUploadProvider uploadProvider;

	@BeforeEach
	void resetState() {
		clearDatabase();
		try (RedisConnection connection = redisTemplate.getRequiredConnectionFactory().getConnection()) {
			connection.serverCommands().flushDb();
		}
		given(uploadProvider.issue(anyString(), any(FileUploadRequest.class)))
			.willReturn(new UploadResponse(
				"https://s3.example/upload",
				"https://s3.example/file.jpg",
				Map.of("Content-Type", "image/jpeg"),
				Instant.parse("2026-07-29T01:00:00Z")));
	}

	@Test
	void anAccessTokenIssuedBeforeWithdrawalCannotUseProtectedApis() throws Exception {
		Session session = signupAndLogin(LOGIN_ID, SIGNUP_BODY);
		Session reissued = reissue(session);
		assertThat(reissued.accessToken()).isNotEqualTo(session.accessToken());
		requestPresignedUrl(session).andExpect(status().isCreated());

		mockMvc.perform(delete("/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + reissued.accessToken()))
			.andExpect(status().isNoContent());

		requestPresignedUrl(session)
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
		assertThat(redisTemplate.getExpire("blacklist:user:" + session.userId()))
			.as("차단 기간은 Access Token 유효 기간이어야 한다")
			.isGreaterThan(0L)
			.isLessThanOrEqualTo(ACCESS_TOKEN_VALIDITY.toSeconds());
	}

	@Test
	void withdrawalDoesNotBlockOtherAccounts() throws Exception {
		Session withdrawing = signupAndLogin(LOGIN_ID, SIGNUP_BODY);
		Session remaining = signupAndLogin(OTHER_LOGIN_ID, OTHER_SIGNUP_BODY);

		mockMvc.perform(delete("/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + withdrawing.accessToken()))
			.andExpect(status().isNoContent());

		requestPresignedUrl(remaining).andExpect(status().isCreated());
	}

	/**
	 * 이 테스트는 트랜잭션을 커밋하므로 롤백으로 정리되지 않는다. 남긴 계정은 전역 행 수를 확인하는
	 * 다른 테스트를 깨뜨리므로 종료 후에도 지운다.
	 */
	@AfterEach
	void clearCommittedState() {
		clearDatabase();
	}

	private void clearDatabase() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createQuery("delete from GroupMember").executeUpdate();
			entityManager.createQuery("delete from FamilyGroup").executeUpdate();
			entityManager.createQuery("delete from User").executeUpdate();
			entityManager.flush();
		});
	}

	private ResultActions requestPresignedUrl(Session session) throws Exception {
		return mockMvc.perform(post("/files/presigned-urls")
			.header(HttpHeaders.AUTHORIZATION, "Bearer " + session.accessToken())
			.contentType(MediaType.APPLICATION_JSON)
			.content(PRESIGNED_URL_BODY));
	}

	private Session signupAndLogin(String loginId, String signupBody) throws Exception {
		mockMvc.perform(post("/auth/signup").contentType(MediaType.APPLICATION_JSON).content(signupBody))
			.andExpect(status().isCreated());

		MvcResult result = mockMvc.perform(post("/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"loginId\": \"%s\", \"password\": \"%s\"}".formatted(loginId, PASSWORD)))
			.andExpect(status().isOk())
			.andReturn();

		JsonNode data = readData(result);
		return new Session(
			data.path("user").path("id").asLong(),
			data.path("accessToken").asText(),
			data.path("refreshToken").asText());
	}

	private Session reissue(Session session) throws Exception {
		MvcResult result = mockMvc.perform(post("/auth/reissue")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"refreshToken\": \"%s\"}".formatted(session.refreshToken())))
			.andExpect(status().isOk())
			.andReturn();

		JsonNode data = readData(result);
		return new Session(
			session.userId(),
			data.path("accessToken").asText(),
			data.path("refreshToken").asText());
	}

	private JsonNode readData(MvcResult result) throws Exception {
		return objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
	}

	private record Session(Long userId, String accessToken, String refreshToken) {
	}
}
