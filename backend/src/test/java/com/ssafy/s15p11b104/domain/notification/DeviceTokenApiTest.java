package com.ssafy.s15p11b104.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRegistrationStore;

@AutoConfigureMockMvc
class DeviceTokenApiTest extends NotificationApiIntegrationTestSupport {

	@MockitoSpyBean
	private DeviceTokenRegistrationStore registrationStore;

	@Test
	void registerCreatesThenReactivatesTheSameOpaqueTokenWithoutChangingItsId() throws Exception {
		TestUser user = createUser("tokenuser", "사용자");
		String token = " opaque token value ";

		mockMvc.perform(authorized(postRequest("/device-tokens"), user)
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody(token)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.message").value("기기 토큰 등록 성공"))
			.andExpect(jsonPath("$.data.deviceType").value("ANDROID"))
			.andExpect(jsonPath("$.data.active").value(true));

		DeviceToken created = deviceTokenRepository.findByToken(token).orElseThrow();
		Long originalId = created.getId();
		assertThat(created.getToken()).isEqualTo(token);

		mockMvc.perform(authorized(deleteRequest("/device-tokens"), user)
				.contentType(MediaType.APPLICATION_JSON)
				.content(deleteBody(token)))
			.andExpect(status().isNoContent());
		assertThat(deviceTokenRepository.findById(originalId).orElseThrow().isActive()).isFalse();

		mockMvc.perform(authorized(postRequest("/device-tokens"), user)
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody(token)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(originalId))
			.andExpect(jsonPath("$.data.active").value(true));

		DeviceToken reactivated = deviceTokenRepository.findByToken(token).orElseThrow();
		assertThat(reactivated.getId()).isEqualTo(originalId);
		assertThat(reactivated.isActive()).isTrue();
	}

	@Test
	void registrationTransfersOwnershipAndOnlyTheCurrentOwnerCanDeactivate() throws Exception {
		TestUser first = createUser("tokenown1", "첫 사용자");
		TestUser second = createUser("tokenown2", "둘 사용자");
		String token = "shared-token";

		mockMvc.perform(authorized(postRequest("/device-tokens"), first)
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody(token)))
			.andExpect(status().isCreated());
		Long id = deviceTokenRepository.findByToken(token).orElseThrow().getId();

		mockMvc.perform(authorized(postRequest("/device-tokens"), second)
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody(token)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(id));

		DeviceToken transferred = deviceTokenRepository.findByToken(token).orElseThrow();
		assertThat(transferred.getUser().getId()).isEqualTo(second.entity().getId());
		assertThat(transferred.isActive()).isTrue();

		mockMvc.perform(authorized(deleteRequest("/device-tokens"), first)
				.contentType(MediaType.APPLICATION_JSON)
				.content(deleteBody(token)))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		mockMvc.perform(authorized(deleteRequest("/device-tokens"), second)
				.contentType(MediaType.APPLICATION_JSON)
				.content(deleteBody(token)))
			.andExpect(status().isNoContent());
		mockMvc.perform(authorized(deleteRequest("/device-tokens"), second)
				.contentType(MediaType.APPLICATION_JSON)
				.content(deleteBody(token)))
			.andExpect(status().isNoContent());
		mockMvc.perform(authorized(deleteRequest("/device-tokens"), second)
				.contentType(MediaType.APPLICATION_JSON)
				.content(deleteBody("missing-token")))
			.andExpect(status().isNoContent());
	}

	@Test
	void concurrentRegistrationKeepsOneRowAndReturnsOneCreatedAndOneOk() throws Exception {
		TestUser first = createUser("tokencon1", "첫 사용자");
		TestUser second = createUser("tokencon2", "둘 사용자");
		String token = "concurrent-token";
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			CompletableFuture<Integer> firstRequest = concurrentRegister(executor, ready, start, first, token);
			CompletableFuture<Integer> secondRequest = concurrentRegister(executor, ready, start, second, token);
			ready.await();
			start.countDown();

			List<Integer> statuses = List.of(firstRequest.join(), secondRequest.join());
			assertThat(statuses).containsExactlyInAnyOrder(201, 200);
		}

		assertThat(deviceTokenRepository.count()).isEqualTo(1);
		assertThat(deviceTokenRepository.findByToken(token).orElseThrow().isActive()).isTrue();
	}

	@Test
	void concurrentWithdrawalCannotBeFollowedByTokenReactivation() throws Exception {
		TestUser user = createUser("tokenexit", "사용자");
		String token = "withdrawal-race-token";
		CountDownLatch registrationEntered = new CountDownLatch(1);
		CountDownLatch allowRegistration = new CountDownLatch(1);

		doAnswer(invocation -> {
			registrationEntered.countDown();
			if (!allowRegistration.await(5, TimeUnit.SECONDS)) {
				throw new IllegalStateException("기기 토큰 등록 대기 시간이 초과되었습니다.");
			}
			return invocation.callRealMethod();
		}).when(registrationStore).register(anyLong(), eq(token), eq("ANDROID"), any(Instant.class));

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			CompletableFuture<Integer> registration = CompletableFuture.supplyAsync(
				() -> performRegister(user, token),
				executor);
			assertThat(registrationEntered.await(5, TimeUnit.SECONDS)).isTrue();

			CompletableFuture<Integer> withdrawal = CompletableFuture.supplyAsync(
				() -> performWithdrawal(user),
				executor);
			try {
				assertThatThrownBy(() -> withdrawal.get(500, TimeUnit.MILLISECONDS))
					.isInstanceOf(TimeoutException.class);
			} finally {
				allowRegistration.countDown();
			}

			assertThat(registration.join()).isEqualTo(201);
			assertThat(withdrawal.join()).isEqualTo(204);
		}

		assertThat(userRepository.findById(user.entity().getId()).orElseThrow().getWithdrawnAt()).isNotNull();
		assertThat(deviceTokenRepository.findByToken(token).orElseThrow().isActive()).isFalse();
	}

	@Test
	void registrationAndDeletionValidateBodiesAndRequireAuthentication() throws Exception {
		TestUser user = createUser("tokenval1", "사용자");
		String tooLong = "x".repeat(501);

		for (String body : new String[] {
			registerBody(" "),
			registerBody(tooLong),
			"{\"token\":\"valid\",\"deviceType\":\"IOS\"}",
			"{\"token\":\"valid\"}"
		}) {
			mockMvc.perform(authorized(postRequest("/device-tokens"), user)
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}
		mockMvc.perform(authorized(deleteRequest("/device-tokens"), user)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"token\":\" \"}"))
			.andExpect(status().isBadRequest());
		mockMvc.perform(postRequest("/device-tokens")
				.contentType(MediaType.APPLICATION_JSON)
				.content(registerBody("valid-token")))
			.andExpect(status().isUnauthorized());
	}

	private CompletableFuture<Integer> concurrentRegister(
		ExecutorService executor,
		CountDownLatch ready,
		CountDownLatch start,
		TestUser user,
		String token
	) {
		return CompletableFuture.supplyAsync(() -> {
			ready.countDown();
			try {
				start.await();
				return mockMvc.perform(authorized(postRequest("/device-tokens"), user)
						.contentType(MediaType.APPLICATION_JSON)
						.content(registerBody(token)))
					.andReturn()
					.getResponse()
					.getStatus();
			} catch (Exception exception) {
				throw new CompletionException(exception);
			}
		}, executor);
	}

	private int performRegister(TestUser user, String token) {
		try {
			return mockMvc.perform(authorized(postRequest("/device-tokens"), user)
					.contentType(MediaType.APPLICATION_JSON)
					.content(registerBody(token)))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new CompletionException(exception);
		}
	}

	private int performWithdrawal(TestUser user) {
		try {
			return mockMvc.perform(authorized(deleteRequest("/users/me"), user))
				.andReturn()
				.getResponse()
				.getStatus();
		} catch (Exception exception) {
			throw new CompletionException(exception);
		}
	}

	private String registerBody(String token) throws Exception {
		return objectMapper.writeValueAsString(new RegisterRequest(token, "ANDROID"));
	}

	private String deleteBody(String token) throws Exception {
		return objectMapper.writeValueAsString(new DeleteRequest(token));
	}

	private record RegisterRequest(String token, String deviceType) {
	}

	private record DeleteRequest(String token) {
	}
}
