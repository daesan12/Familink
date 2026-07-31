package com.ssafy.s15p11b104.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;

@AutoConfigureMockMvc
class NotificationApiTest extends NotificationApiIntegrationTestSupport {

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@Test
	void unreadCountAndListReturnOnlyTheAuthenticatedUsersNotificationsInFixedOrder() throws Exception {
		TestUser receiver = createUser("receiver1", "수신자");
		TestUser actor = createUser("actoruser", "행위자");
		TestUser other = createUser("otheruser", "다른 사용자");
		FamilyGroup group = familyGroupRepository.saveAndFlush(new FamilyGroup("우리 가족", "ABC123"));

		Notification older = notificationRepository.saveAndFlush(new Notification(
			receiver.entity(),
			actor.entity(),
			group,
			NotificationType.NEW_POST,
			"첫 알림",
			"첫 내용"));
		Notification newer = notificationRepository.saveAndFlush(new Notification(
			receiver.entity(),
			NotificationType.DAILY_REPORT,
			"둘째 알림",
			"둘째 내용"));
		notificationRepository.saveAndFlush(new Notification(
			other.entity(),
			NotificationType.CALL_REPORT,
			"타인 알림",
			"보이면 안 됨"));

		Instant sameCreatedAt = Instant.parse("2026-07-31T00:00:00Z");
		jdbcTemplate.update(
			"update notifications set created_at = ? where id in (?, ?)",
			OffsetDateTime.ofInstant(sameCreatedAt, ZoneOffset.UTC),
			older.getId(),
			newer.getId());

		mockMvc.perform(authorized(getRequest("/notifications/unread-count"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.message").value("읽지 않은 알림 개수 조회 성공"))
			.andExpect(jsonPath("$.data.unreadCount").value(2));

		mockMvc.perform(authorized(getRequest("/notifications").param("size", "1"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("알림 목록 조회 성공"))
			.andExpect(jsonPath("$.data.content.length()").value(1))
			.andExpect(jsonPath("$.data.content[0].id").value(newer.getId()))
			.andExpect(jsonPath("$.data.content[0].actor").value(nullValue()))
			.andExpect(jsonPath("$.data.hasNext").value(true));

		mockMvc.perform(authorized(
				getRequest("/notifications").param("page", "1").param("size", "1"),
				receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].id").value(older.getId()))
			.andExpect(jsonPath("$.data.content[0].groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.content[0].actor.userId").value(actor.entity().getId()))
			.andExpect(jsonPath("$.data.content[0].actor.name").value("행위자"))
			.andExpect(jsonPath("$.data.content[0].actor.profileImageUrl").value(nullValue()))
			.andExpect(jsonPath("$.data.content[0].actor.memberId").doesNotExist())
			.andExpect(jsonPath("$.data.content[0].actor.loginId").doesNotExist())
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestId").value(nullValue()))
			.andExpect(jsonPath("$.data.hasNext").value(false));
	}

	@Test
	void readOneIsIdempotentAndDoesNotRevealOtherUsersOrMissingNotifications() throws Exception {
		TestUser owner = createUser("owneruser", "소유자");
		TestUser other = createUser("readerusr", "다른 사용자");
		Notification owned = notificationRepository.saveAndFlush(new Notification(
			owner.entity(),
			NotificationType.EVENT_CHANGED,
			"일정 변경",
			"일정이 바뀌었습니다."));
		Notification foreign = notificationRepository.saveAndFlush(new Notification(
			other.entity(),
			NotificationType.NEW_POST,
			"타인 알림",
			"타인 내용"));

		MvcResult first = mockMvc.perform(authorized(
				patchRequest("/notifications/{id}/read", owned.getId()),
				owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("알림 읽음 처리 성공"))
			.andExpect(jsonPath("$.data.id").value(owned.getId()))
			.andExpect(jsonPath("$.data.readAt").isString())
			.andReturn();
		String firstReadAt = objectMapper
			.readTree(first.getResponse().getContentAsString())
			.path("data")
			.path("readAt")
			.asText();

		mockMvc.perform(authorized(
				patchRequest("/notifications/{id}/read", owned.getId()),
				owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.readAt").value(firstReadAt));

		mockMvc.perform(authorized(
				patchRequest("/notifications/{id}/read", foreign.getId()),
				owner))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(authorized(
				patchRequest("/notifications/{id}/read", 999999),
				owner))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void listKeepsTheActorIdButReturnsNullableProfileFieldsAfterWithdrawal() throws Exception {
		TestUser receiver = createUser("receiver2", "수신자");
		TestUser actor = createUser("actorold1", "탈퇴 전 이름");
		Notification notification = notificationRepository.saveAndFlush(new Notification(
			receiver.entity(),
			actor.entity(),
			null,
			NotificationType.POST_ACTIVITY,
			"반응 알림",
			"게시글에 반응했습니다."));
		actor.entity().withdraw(Instant.parse("2026-07-30T00:00:00Z"));
		userRepository.saveAndFlush(actor.entity());

		mockMvc.perform(authorized(getRequest("/notifications"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].id").value(notification.getId()))
			.andExpect(jsonPath("$.data.content[0].actor.userId").value(actor.entity().getId()))
			.andExpect(jsonPath("$.data.content[0].actor.name").value(nullValue()))
			.andExpect(jsonPath("$.data.content[0].actor.profileImageUrl").value(nullValue()));
	}

	@Test
	void readAllUpdatesOnlyUnreadNotificationsForTheAuthenticatedUser() throws Exception {
		TestUser owner = createUser("allreader", "소유자");
		TestUser other = createUser("allother1", "다른 사용자");
		Notification alreadyRead = new Notification(
			owner.entity(),
			NotificationType.NEW_POST,
			"이미 읽음",
			"내용");
		Instant originalReadAt = Instant.parse("2026-07-30T00:00:00Z");
		alreadyRead.markRead(originalReadAt);
		notificationRepository.saveAndFlush(alreadyRead);
		notificationRepository.saveAndFlush(new Notification(
			owner.entity(),
			NotificationType.DAILY_REPORT,
			"안 읽음 1",
			"내용"));
		notificationRepository.saveAndFlush(new Notification(
			owner.entity(),
			NotificationType.CALL_REPORT,
			"안 읽음 2",
			"내용"));
		Notification foreign = notificationRepository.saveAndFlush(new Notification(
			other.entity(),
			NotificationType.CALL_REPORT,
			"타인 알림",
			"내용"));

		MvcResult result = mockMvc.perform(authorized(
				patchRequest("/notifications/read-all"),
				owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("전체 알림 읽음 처리 성공"))
			.andExpect(jsonPath("$.data.updatedCount").value(2))
			.andExpect(jsonPath("$.data.readAt").isString())
			.andReturn();

		JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
		assertThat(notificationRepository.findById(alreadyRead.getId()).orElseThrow().getReadAt())
			.isEqualTo(originalReadAt);
		assertThat(notificationRepository.findById(foreign.getId()).orElseThrow().getReadAt()).isNull();
		assertThat(notificationRepository.countByReceiver_IdAndReadAtIsNull(owner.entity().getId())).isZero();
		assertThat(data.path("readAt").asText()).isNotBlank();

		mockMvc.perform(authorized(patchRequest("/notifications/read-all"), owner))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.updatedCount").value(0))
			.andExpect(jsonPath("$.data.readAt").isString());
	}

	@Test
	void listRejectsInvalidPaginationAndSortAndRequiresAuthentication() throws Exception {
		TestUser user = createUser("pageuser1", "사용자");

		mockMvc.perform(authorized(getRequest("/notifications").param("page", "-1"), user))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(authorized(getRequest("/notifications").param("size", "0"), user))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(authorized(getRequest("/notifications").param("size", "101"), user))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(authorized(getRequest("/notifications").param("sort", "createdAt,asc"), user))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		mockMvc.perform(getRequest("/notifications/unread-count"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
	}
}
