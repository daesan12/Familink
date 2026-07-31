package com.ssafy.s15p11b104.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;

@AutoConfigureMockMvc
class NotificationSettingApiTest extends NotificationApiIntegrationTestSupport {

	private static final String COMPLETE_SETTINGS = """
		{
		  "settings": [
		    {"notificationType": "NEW_POST", "enabled": false},
		    {"notificationType": "POST_ACTIVITY", "enabled": true},
		    {"notificationType": "EVENT_CHANGED", "enabled": false},
		    {"notificationType": "EVENT_REMINDER", "enabled": true},
		    {"notificationType": "CALL_REPORT", "enabled": false},
		    {"notificationType": "DAILY_REPORT", "enabled": true},
		    {"notificationType": "GROUP_JOIN_REQUEST", "enabled": false}
		  ]
		}
		""";

	@Test
	void getWithoutSavedRowsReturnsAllSevenTypesEnabled() throws Exception {
		TestUser user = createUser("setting01", "사용자");

		mockMvc.perform(authorized(getRequest("/notification-settings"), user))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("푸시 알림 설정 조회 성공"))
			.andExpect(jsonPath("$.data.settings.length()").value(7))
			.andExpect(jsonPath("$.data.settings[0].notificationType").value("NEW_POST"))
			.andExpect(jsonPath("$.data.settings[0].enabled").value(true))
			.andExpect(jsonPath("$.data.settings[6].notificationType").value("GROUP_JOIN_REQUEST"))
			.andExpect(jsonPath("$.data.settings[6].enabled").value(true));
	}

	@Test
	void putPersistsExactlySevenSettingsAndReturnsTheirUpdateTime() throws Exception {
		TestUser user = createUser("setting02", "사용자");

		mockMvc.perform(authorized(putRequest("/notification-settings"), user)
				.contentType(MediaType.APPLICATION_JSON)
				.content(COMPLETE_SETTINGS))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("푸시 알림 설정 저장 성공"))
			.andExpect(jsonPath("$.data.updatedAt").isString());

		mockMvc.perform(authorized(getRequest("/notification-settings"), user))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.settings.length()").value(7))
			.andExpect(jsonPath("$.data.settings[0].notificationType").value("NEW_POST"))
			.andExpect(jsonPath("$.data.settings[0].enabled").value(false))
			.andExpect(jsonPath("$.data.settings[1].notificationType").value("POST_ACTIVITY"))
			.andExpect(jsonPath("$.data.settings[1].enabled").value(true))
			.andExpect(jsonPath("$.data.settings[6].notificationType").value("GROUP_JOIN_REQUEST"))
			.andExpect(jsonPath("$.data.settings[6].enabled").value(false));
	}

	@Test
	void putRejectsMissingDuplicateNullAndUnknownSettings() throws Exception {
		TestUser user = createUser("setting03", "사용자");
		String missing = """
			{"settings": [
			  {"notificationType": "NEW_POST", "enabled": true},
			  {"notificationType": "POST_ACTIVITY", "enabled": true},
			  {"notificationType": "EVENT_CHANGED", "enabled": true},
			  {"notificationType": "EVENT_REMINDER", "enabled": true},
			  {"notificationType": "CALL_REPORT", "enabled": true},
			  {"notificationType": "DAILY_REPORT", "enabled": true}
			]}
			""";
		String duplicate = COMPLETE_SETTINGS.replace(
			"\"GROUP_JOIN_REQUEST\", \"enabled\": false",
			"\"NEW_POST\", \"enabled\": false");
		String nullEnabled = COMPLETE_SETTINGS.replace(
			"\"NEW_POST\", \"enabled\": false",
			"\"NEW_POST\", \"enabled\": null");
		String unknown = COMPLETE_SETTINGS.replace("\"NEW_POST\"", "\"UNKNOWN\"");

		for (String body : new String[] {missing, duplicate, nullEnabled, unknown, "{\"settings\": null}"}) {
			mockMvc.perform(authorized(putRequest("/notification-settings"), user)
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}
	}

	@Test
	void concurrentFirstUpdatesBothSucceedAndKeepExactlySevenRows() throws Exception {
		TestUser user = createUser("setting04", "사용자");
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			CompletableFuture<Integer> first = concurrentUpdate(executor, ready, start, user);
			CompletableFuture<Integer> second = concurrentUpdate(executor, ready, start, user);
			ready.await();
			start.countDown();

			assertThat(List.of(first.join(), second.join())).containsExactly(200, 200);
		}

		assertThat(notificationSettingRepository.count()).isEqualTo(7);
	}

	@Test
	void settingsRequireAuthentication() throws Exception {
		mockMvc.perform(getRequest("/notification-settings"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(putRequest("/notification-settings")
				.contentType(MediaType.APPLICATION_JSON)
				.content(COMPLETE_SETTINGS))
			.andExpect(status().isUnauthorized());
	}

	private CompletableFuture<Integer> concurrentUpdate(
		ExecutorService executor,
		CountDownLatch ready,
		CountDownLatch start,
		TestUser user
	) {
		return CompletableFuture.supplyAsync(() -> {
			ready.countDown();
			try {
				start.await();
				return mockMvc.perform(authorized(putRequest("/notification-settings"), user)
						.contentType(MediaType.APPLICATION_JSON)
						.content(COMPLETE_SETTINGS))
					.andReturn()
					.getResponse()
					.getStatus();
			} catch (Exception exception) {
				throw new CompletionException(exception);
			}
		}, executor);
	}
}
