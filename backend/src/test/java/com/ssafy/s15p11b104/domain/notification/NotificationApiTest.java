package com.ssafy.s15p11b104.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@AutoConfigureMockMvc
class NotificationApiTest extends NotificationApiIntegrationTestSupport {

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@Autowired
	private GroupJoinRequestRepository groupJoinRequestRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private CallSessionRepository callSessionRepository;

	@Autowired
	private CallReportCallRepository callReportRepository;

	@Autowired
	private DailyReportRepository dailyReportRepository;

	@MockitoBean
	private MediaDownloadUrlProvider mediaDownloadUrlProvider;

	@Test
	void unreadCountAndListReturnOnlyTheAuthenticatedUsersNotificationsInFixedOrder() throws Exception {
		TestUser receiver = createUser("receiver1", "수신자");
		TestUser actor = createUser("actoruser", "행위자");
		actor.entity().updateProfileImageUrl("https://cdn/profile-image/actor.jpg");
		userRepository.saveAndFlush(actor.entity());
		given(mediaDownloadUrlProvider.issueProfileImageDownloadUrl(
			"https://cdn/profile-image/actor.jpg"))
			.willReturn("https://signed.example/actor.jpg");
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
			.andExpect(jsonPath("$.data.content[0].actor.profileImageUrl")
				.value("https://signed.example/actor.jpg"))
			.andExpect(jsonPath("$.data.content[0].actor.memberId").doesNotExist())
			.andExpect(jsonPath("$.data.content[0].actor.loginId").doesNotExist())
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestId").value(nullValue()))
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestStatus").value(nullValue()))
			.andExpect(jsonPath("$.data.hasNext").value(false));

		verify(mediaDownloadUrlProvider).issueProfileImageDownloadUrl(
			"https://cdn/profile-image/actor.jpg");
		assertThat(userRepository.findById(actor.entity().getId()).orElseThrow().getProfileImageUrl())
			.isEqualTo("https://cdn/profile-image/actor.jpg");
	}

	@Test
	void listReturnsTheCurrentJoinRequestStatusForDecisionNotifications() throws Exception {
		TestUser receiver = createUser("statusreceiver", "관리자");
		TestUser applicant = createUser("statusapplicant", "신청자");
		FamilyGroup group = familyGroupRepository.saveAndFlush(new FamilyGroup("상태 그룹", "STA123"));
		GroupJoinRequest joinRequest = groupJoinRequestRepository.saveAndFlush(
			new GroupJoinRequest(group, applicant.entity(), JoinRequestStatus.PENDING_ADMIN));
		Notification notification = notificationRepository.saveAndFlush(new Notification(
			receiver.entity(),
			applicant.entity(),
			group,
			NotificationType.GROUP_JOIN_REQUEST,
			"가입 요청",
			"가입 요청이 도착했어요."));
		jdbcTemplate.update(
			"update notifications set related_join_request_id = ? where id = ?",
			joinRequest.getId(),
			notification.getId());

		mockMvc.perform(authorized(getRequest("/notifications"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestId")
				.value(joinRequest.getId()))
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestStatus")
				.value("PENDING_ADMIN"));

		joinRequest.approve(GroupRole.GUARDIAN, Instant.parse("2026-08-03T00:00:00Z"));
		groupJoinRequestRepository.saveAndFlush(joinRequest);

		mockMvc.perform(authorized(getRequest("/notifications"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestStatus")
				.value("APPROVED"));

		GroupJoinRequest rejectedRequest = groupJoinRequestRepository.saveAndFlush(
			new GroupJoinRequest(group, applicant.entity(), JoinRequestStatus.PENDING_ADMIN));
		rejectedRequest.reject(Instant.parse("2026-08-03T00:01:00Z"));
		groupJoinRequestRepository.saveAndFlush(rejectedRequest);
		Notification rejectedNotification = notificationRepository.saveAndFlush(new Notification(
			receiver.entity(),
			applicant.entity(),
			group,
			NotificationType.GROUP_JOIN_REQUEST,
			"가입 요청 거절",
			"가입 요청이 거절되었습니다."));
		jdbcTemplate.update(
			"update notifications set related_join_request_id = ? where id = ?",
			rejectedRequest.getId(),
			rejectedNotification.getId());

		mockMvc.perform(authorized(getRequest("/notifications"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestStatus")
				.value("REJECTED"));
	}

	@Test
	void listDoesNotExposeJoinRequestStatusForOtherNotificationTypes() throws Exception {
		TestUser receiver = createUser("otherstatrecv", "수신자");
		TestUser applicant = createUser("otherstatapp", "신청자");
		FamilyGroup group = familyGroupRepository.saveAndFlush(new FamilyGroup("관계 그룹", "REL123"));
		GroupJoinRequest joinRequest = groupJoinRequestRepository.saveAndFlush(
			new GroupJoinRequest(group, applicant.entity(), JoinRequestStatus.PENDING_ADMIN));
		Notification notification = notificationRepository.saveAndFlush(new Notification(
			receiver.entity(),
			applicant.entity(),
			group,
			NotificationType.NEW_POST,
			"새 게시글",
			"가입 요청과 무관한 알림입니다."));
		jdbcTemplate.update(
			"update notifications set related_join_request_id = ? where id = ?",
			joinRequest.getId(),
			notification.getId());

		mockMvc.perform(authorized(getRequest("/notifications"), receiver))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestId")
				.value(joinRequest.getId()))
			.andExpect(jsonPath("$.data.content[0].relatedJoinRequestStatus")
				.value(nullValue()));
	}

	@Test
	void listExposesReportRoutingKeysOnlyForReportNotifications() throws Exception {
		TestUser guardian = createUser("reportrecv", "보호자");
		TestUser careReceiver = createUser("reportcare", "피보호자");
		FamilyGroup group = familyGroupRepository.saveAndFlush(new FamilyGroup("리포트 그룹", "REP123"));
		GroupMember careReceiverMember = groupMemberRepository.saveAndFlush(new GroupMember(
			group,
			careReceiver.entity(),
			GroupRole.CARE_RECEIVER,
			false,
			Instant.parse("2026-08-01T00:00:00Z")));

		CallSession callSession = new CallSession(group, careReceiverMember, 1L, CallStatus.CONNECTING);
		callSession.markConnected(Instant.parse("2026-08-03T12:00:00Z"));
		// KST 22:30 종료 → 리포트 날짜는 다음 날로 넘어가는 경계 케이스
		callSession.endByUser(Instant.parse("2026-08-03T13:30:00Z"));
		callSession.finalizeTranscript(Instant.parse("2026-08-03T13:31:00Z"));
		callSessionRepository.saveAndFlush(callSession);
		CallReport callReport = callReportRepository.saveAndFlush(new CallReport(
			callSession, "통화 요약", EmotionCategory.NEUTRAL, "평온", null));
		DailyReport dailyReport = dailyReportRepository.saveAndFlush(new DailyReport(
			group, careReceiverMember, LocalDate.of(2026, 8, 3), "하루 요약", EmotionCategory.JOY, "기쁨"));

		Notification postNotification = notificationRepository.saveAndFlush(new Notification(
			guardian.entity(), NotificationType.NEW_POST, "새 게시글", "내용"));
		Notification callNotification = notificationRepository.saveAndFlush(new Notification(
			guardian.entity(), NotificationType.CALL_REPORT, "통화 리포트", "내용"));
		Notification dailyNotification = notificationRepository.saveAndFlush(new Notification(
			guardian.entity(), NotificationType.DAILY_REPORT, "일일 리포트", "내용"));
		jdbcTemplate.update(
			"update notifications set related_call_report_id = ? where id = ?",
			callReport.getId(),
			callNotification.getId());
		jdbcTemplate.update(
			"update notifications set related_daily_report_id = ? where id = ?",
			dailyReport.getId(),
			dailyNotification.getId());

		mockMvc.perform(authorized(getRequest("/notifications"), guardian))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content.length()").value(3))
			.andExpect(jsonPath("$.data.content[0].id").value(dailyNotification.getId()))
			.andExpect(jsonPath("$.data.content[0].relatedDailyReportId").value(dailyReport.getId()))
			.andExpect(jsonPath("$.data.content[0].relatedCallSessionId").value(nullValue()))
			.andExpect(jsonPath("$.data.content[0].relatedCareReceiverMemberId")
				.value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.content[0].relatedReportDate").value("2026-08-03"))
			.andExpect(jsonPath("$.data.content[1].id").value(callNotification.getId()))
			.andExpect(jsonPath("$.data.content[1].relatedCallReportId").value(callReport.getId()))
			.andExpect(jsonPath("$.data.content[1].relatedCallSessionId").value(callSession.getId()))
			.andExpect(jsonPath("$.data.content[1].relatedCareReceiverMemberId")
				.value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.content[1].relatedReportDate").value("2026-08-04"))
			.andExpect(jsonPath("$.data.content[2].id").value(postNotification.getId()))
			.andExpect(jsonPath("$.data.content[2].relatedCallSessionId").value(nullValue()))
			.andExpect(jsonPath("$.data.content[2].relatedCareReceiverMemberId").value(nullValue()))
			.andExpect(jsonPath("$.data.content[2].relatedReportDate").value(nullValue()));
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
	void deletingOneNotificationOnlyAllowsItsReceiver() throws Exception {
		TestUser owner = createUser("deleteowner", "알림 삭제자");
		TestUser other = createUser("deleteother", "다른 사용자");
		Notification owned = notificationRepository.saveAndFlush(new Notification(
			owner.entity(),
			NotificationType.NEW_POST,
			"삭제 대상",
			"내 알림"));
		Notification foreign = notificationRepository.saveAndFlush(new Notification(
			other.entity(),
			NotificationType.NEW_POST,
			"다른 알림",
			"다른 사용자의 알림"));

		mockMvc.perform(authorized(deleteRequest("/notifications/" + owned.getId()), owner))
			.andExpect(status().isNoContent());
		assertThat(notificationRepository.findById(owned.getId())).isEmpty();

		mockMvc.perform(authorized(deleteRequest("/notifications/" + foreign.getId()), owner))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		assertThat(notificationRepository.findById(foreign.getId())).isPresent();
	}

	@Test
	void deletingAllNotificationsOnlyDeletesTheAuthenticatedUsersRows() throws Exception {
		TestUser owner = createUser("deleteall1", "전체 삭제자");
		TestUser other = createUser("deleteall2", "다른 사용자");
		notificationRepository.saveAndFlush(new Notification(
			owner.entity(), NotificationType.CALL_REPORT, "첫 알림", "내용"));
		notificationRepository.saveAndFlush(new Notification(
			owner.entity(), NotificationType.DAILY_REPORT, "둘째 알림", "내용"));
		Notification foreign = notificationRepository.saveAndFlush(new Notification(
			other.entity(), NotificationType.NEW_POST, "보존 알림", "내용"));

		mockMvc.perform(authorized(deleteRequest("/notifications"), owner))
			.andExpect(status().isNoContent());
		assertThat(notificationRepository.countByReceiver_Id(owner.entity().getId())).isZero();
		assertThat(notificationRepository.findById(foreign.getId())).isPresent();
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
