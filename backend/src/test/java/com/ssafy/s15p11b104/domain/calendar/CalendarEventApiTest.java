package com.ssafy.s15p11b104.domain.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.entity.EventParticipant;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 일정 목록·상세 조회와 등록·수정·삭제, 참여자 전체 교체를 검증한다.
 *
 * <p>여러 날에 걸친 일정의 기간 겹침 조회와, 시간 일정의 날짜 쌍을 서버가 {@code Asia/Seoul} 기준으로
 * 파생하는 규칙을 KST 자정 경계값으로 고정한다.
 */
@AutoConfigureMockMvc
@Transactional
class CalendarEventApiTest extends IntegrationTest {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
	private static final long UNKNOWN_ID = 999_999L;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private CalendarEventRepository calendarEventRepository;

	@Autowired
	private EventParticipantRepository eventParticipantRepository;

	private User managerUser;
	private User creatorUser;
	private User memberUser;
	private User leftUser;
	private User otherGroupUser;
	private User outsiderUser;
	private FamilyGroup group;
	private FamilyGroup otherGroup;
	private GroupMember managerMember;
	private GroupMember creatorMember;
	private GroupMember memberMember;
	private GroupMember leftMember;
	private GroupMember otherGroupMember;

	@BeforeEach
	void setUp() {
		entityManager.createNativeQuery("DELETE FROM event_participants").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM calendar_events").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_interests").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_aliases").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM posts").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM group_join_requests").executeUpdate();
		groupMemberRepository.deleteAll();
		familyGroupRepository.deleteAll();
		userRepository.deleteAll();
		entityManager.flush();

		managerUser = userRepository.save(user("cal_manager", "관리자"));
		creatorUser = userRepository.save(user("cal_creator", "작성자"));
		memberUser = userRepository.save(user("cal_member", "구성원"));
		leftUser = userRepository.save(user("cal_left", "탈퇴자"));
		otherGroupUser = userRepository.save(user("cal_other", "타그룹"));
		outsiderUser = userRepository.save(user("cal_outsider", "외부인"));
		group = familyGroupRepository.save(new FamilyGroup("우리가족", "CAL123"));
		otherGroup = familyGroupRepository.save(new FamilyGroup("옆집가족", "CAL456"));
		entityManager.flush();

		managerMember = groupMemberRepository.save(
			new GroupMember(group, managerUser, GroupRole.GUARDIAN, true, Instant.now()));
		creatorMember = groupMemberRepository.save(
			new GroupMember(group, creatorUser, GroupRole.GUARDIAN, false, Instant.now()));
		memberMember = groupMemberRepository.save(
			new GroupMember(group, memberUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		leftMember = groupMemberRepository.save(
			new GroupMember(group, leftUser, GroupRole.GUARDIAN, false, Instant.now()));
		leftMember.leave(Instant.now());
		otherGroupMember = groupMemberRepository.save(
			new GroupMember(otherGroup, otherGroupUser, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();
		entityManager.clear();
	}

	// --- 정상 경로 ---

	@Test
	void createStoresAllDayEventWithEqualDatePair() throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "병원 방문", "description": "정기 검진", "eventDate": "2026-08-05"}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.eventId").isNumber())
			.andExpect(jsonPath("$.data.createdAt").isNotEmpty());

		CalendarEvent saved = calendarEventRepository.findAll().get(0);
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getStartAt()).isNull();
		assertThat(saved.getEndAt()).isNull();
		assertThat(saved.getCreatorMember().getId()).isEqualTo(creatorMember.getId());
		assertThat(saved.getLastEditorMember().getId()).isEqualTo(creatorMember.getId());
	}

	@Test
	void detailReturnsEveryContractField() throws Exception {
		Long eventId = persistAllDayEvent("가족 모임", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));
		persistParticipants(eventId, memberMember);

		mockMvc.perform(get("/events/{eventId}", eventId).with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(eventId))
			.andExpect(jsonPath("$.data.groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.title").value("가족 모임"))
			.andExpect(jsonPath("$.data.description").doesNotExist())
			.andExpect(jsonPath("$.data.eventDate").value("2026-08-05"))
			.andExpect(jsonPath("$.data.endDate").value("2026-08-05"))
			.andExpect(jsonPath("$.data.startAt").doesNotExist())
			.andExpect(jsonPath("$.data.endAt").doesNotExist())
			.andExpect(jsonPath("$.data.creatorMemberId").value(creatorMember.getId()))
			.andExpect(jsonPath("$.data.participantMemberIds.length()").value(1))
			.andExpect(jsonPath("$.data.participantMemberIds[0]").value(memberMember.getId()));
	}

	@Test
	void listReturnsEventsInsideRange() throws Exception {
		persistAllDayEvent("일정A", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", "2026-08-01")
				.param("endDate", "2026-08-31")
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.events.length()").value(1))
			.andExpect(jsonPath("$.data.events[0].title").value("일정A"))
			.andExpect(jsonPath("$.data.events[0].eventDate").value("2026-08-05"))
			.andExpect(jsonPath("$.data.events[0].endDate").value("2026-08-05"));
	}

	@Test
	void authorCanReplaceEveryFieldAndParticipants() throws Exception {
		Long eventId = persistAllDayEvent("옛 제목", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));
		persistParticipants(eventId, memberMember);

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"title": "새 제목",
						"description": "새 설명",
						"eventDate": "2026-09-01",
						"endDate": "2026-09-03",
						"participantMemberIds": [%d]
					}
					""".formatted(managerMember.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(eventId))
			.andExpect(jsonPath("$.data.lastEditorMemberId").value(creatorMember.getId()))
			.andExpect(jsonPath("$.data.updatedAt").isNotEmpty());

		mockMvc.perform(get("/events/{eventId}", eventId).with(authenticatedAs(creatorUser.getId())))
			.andExpect(jsonPath("$.data.title").value("새 제목"))
			.andExpect(jsonPath("$.data.description").value("새 설명"))
			.andExpect(jsonPath("$.data.eventDate").value("2026-09-01"))
			.andExpect(jsonPath("$.data.endDate").value("2026-09-03"))
			.andExpect(jsonPath("$.data.participantMemberIds.length()").value(1))
			.andExpect(jsonPath("$.data.participantMemberIds[0]").value(managerMember.getId()));
	}

	@Test
	void authorCanDeleteEventWithParticipants() throws Exception {
		Long eventId = persistAllDayEvent("삭제 대상", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));
		persistParticipants(eventId, memberMember, managerMember);

		mockMvc.perform(delete("/events/{eventId}", eventId).with(authenticatedAs(creatorUser.getId())))
			.andExpect(status().isNoContent())
			.andExpect(content -> assertThat(content.getResponse().getContentAsString()).isEmpty());

		entityManager.flush();
		entityManager.clear();
		assertThat(calendarEventRepository.findById(eventId)).isEmpty();
		assertThat(eventParticipantRepository.findMemberIdsByEventId(eventId)).isEmpty();
	}

	// --- 여러 날 일정과 기간 겹침 조회 ---

	@Test
	void createStoresMultiDayAllDayEvent() throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "가족 여행", "eventDate": "2026-08-05", "endDate": "2026-08-07"}
					"""))
			.andExpect(status().isCreated());

		CalendarEvent saved = calendarEventRepository.findAll().get(0);
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 7));
	}

	@Test
	void listMatchesMultiDayEventOnItsMiddleDay() throws Exception {
		persistAllDayEvent("가족 여행", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 7));

		assertThat(listTitles("2026-08-06", "2026-08-06")).containsExactly("가족 여행");
	}

	@Test
	void listExcludesEventEndingBeforeRange() throws Exception {
		persistAllDayEvent("가족 여행", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 7));

		assertThat(listTitles("2026-08-08", "2026-08-10")).isEmpty();
		assertThat(listTitles("2026-08-01", "2026-08-04")).isEmpty();
	}

	@Test
	void listIncludesEventsTouchingRangeEdges() throws Exception {
		persistAllDayEvent("여행", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 7));
		persistAllDayEvent("생일", LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 10));

		assertThat(listTitles("2026-08-07", "2026-08-10")).containsExactly("여행", "생일");
	}

	@Test
	void listOrdersAllDayEventBeforeTimedEventOnSameDate() throws Exception {
		persistTimedEvent("시간 일정", Instant.parse("2026-08-05T01:00:00Z"), Instant.parse("2026-08-05T02:00:00Z"));
		persistAllDayEvent("하루종일", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		assertThat(listTitles("2026-08-05", "2026-08-05")).containsExactly("하루종일", "시간 일정");
	}

	@Test
	void listExcludesOtherGroupEvents() throws Exception {
		persistAllDayEventIn(otherGroup, otherGroupMember, "옆집 일정",
			LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		assertThat(listTitles("2026-08-01", "2026-08-31")).isEmpty();
	}

	// --- KST 자정 경계에서의 날짜 파생 ---

	@Test
	void timedEventDerivesDatesInKstAndIgnoresRequestDates() throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"title": "새벽 일정",
						"eventDate": "2026-01-01",
						"endDate": "2026-01-01",
						"startAt": "2026-08-04T15:30:00Z",
						"endAt": "2026-08-05T00:00:00Z"
					}
					"""))
			.andExpect(status().isCreated());

		CalendarEvent saved = calendarEventRepository.findAll().get(0);
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getStartAt()).isEqualTo(Instant.parse("2026-08-04T15:30:00Z"));
	}

	@Test
	void timedEventCrossingKstMidnightSpansTwoDates() throws Exception {
		Long eventId = createTimedEvent("2026-08-05T14:30:00Z", "2026-08-05T15:30:00Z");

		CalendarEvent saved = calendarEventRepository.findById(eventId).orElseThrow();
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 6));
	}

	@Test
	void listFindsTimedEventOnItsDerivedEndDate() throws Exception {
		createTimedEvent("2026-08-05T14:30:00Z", "2026-08-05T15:30:00Z");

		assertThat(listTitles("2026-08-06", "2026-08-06")).containsExactly("시간 일정");
	}

	// --- 하루종일과 시간 일정 전환 ---

	@Test
	void updateConvertsAllDayEventToTimedEvent() throws Exception {
		Long eventId = persistAllDayEvent("전환 대상", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{
						"title": "전환 대상",
						"startAt": "2026-08-09T23:00:00Z",
						"endAt": "2026-08-10T01:00:00Z"
					}
					"""))
			.andExpect(status().isOk());

		entityManager.flush();
		entityManager.clear();
		CalendarEvent saved = calendarEventRepository.findById(eventId).orElseThrow();
		assertThat(saved.getStartAt()).isEqualTo(Instant.parse("2026-08-09T23:00:00Z"));
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 10));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 10));
	}

	@Test
	void updateConvertsTimedEventToAllDayEvent() throws Exception {
		Long eventId = createTimedEvent("2026-08-05T01:00:00Z", "2026-08-05T02:00:00Z");

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "하루종일로 전환", "eventDate": "2026-08-20", "endDate": "2026-08-21"}
					"""))
			.andExpect(status().isOk());

		entityManager.flush();
		entityManager.clear();
		CalendarEvent saved = calendarEventRepository.findById(eventId).orElseThrow();
		assertThat(saved.getStartAt()).isNull();
		assertThat(saved.getEndAt()).isNull();
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 20));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 21));
	}

	// --- 권한 ---

	@Test
	void outsiderIsForbiddenOnEveryEndpoint() throws Exception {
		Long eventId = persistAllDayEvent("일정", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));
		RequestPostProcessor outsider = authenticatedAs(outsiderUser.getId());

		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", "2026-08-01").param("endDate", "2026-08-31").with(outsider))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
		mockMvc.perform(get("/events/{eventId}", eventId).with(outsider))
			.andExpect(status().isForbidden());
		mockMvc.perform(post("/groups/{groupId}/events", group.getId()).with(outsider)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "몰래 등록", "eventDate": "2026-08-05"}
					"""))
			.andExpect(status().isForbidden());
		mockMvc.perform(patch("/events/{eventId}", eventId).with(outsider)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "몰래 수정", "eventDate": "2026-08-05"}
					"""))
			.andExpect(status().isForbidden());
		mockMvc.perform(delete("/events/{eventId}", eventId).with(outsider))
			.andExpect(status().isForbidden());
	}

	@Test
	void memberOfAnotherGroupCannotReadEventDetail() throws Exception {
		Long eventId = persistAllDayEvent("일정", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		mockMvc.perform(get("/events/{eventId}", eventId).with(authenticatedAs(otherGroupUser.getId())))
			.andExpect(status().isForbidden());
	}

	@Test
	void plainMemberCannotUpdateOrDeleteEventOfAnother() throws Exception {
		Long eventId = persistAllDayEvent("일정", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(memberUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "수정 시도", "eventDate": "2026-08-05"}
					"""))
			.andExpect(status().isForbidden());
		mockMvc.perform(delete("/events/{eventId}", eventId).with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isForbidden());
	}

	@Test
	void managerCanUpdateAndDeleteEventCreatedByAnother() throws Exception {
		Long eventId = persistAllDayEvent("일정", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "관리자 수정", "eventDate": "2026-08-05"}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.lastEditorMemberId").value(managerMember.getId()));
		mockMvc.perform(delete("/events/{eventId}", eventId).with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNoContent());
	}

	@Test
	void unknownIdsAreRejectedAsForbiddenBecauseContractHasNoNotFound() throws Exception {
		mockMvc.perform(get("/events/{eventId}", UNKNOWN_ID).with(authenticatedAs(creatorUser.getId())))
			.andExpect(status().isForbidden());
		mockMvc.perform(delete("/events/{eventId}", UNKNOWN_ID).with(authenticatedAs(creatorUser.getId())))
			.andExpect(status().isForbidden());
		mockMvc.perform(get("/groups/{groupId}/events", UNKNOWN_ID)
				.param("startDate", "2026-08-01").param("endDate", "2026-08-31")
				.with(authenticatedAs(creatorUser.getId())))
			.andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedRequestIsRejected() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", "2026-08-01").param("endDate", "2026-08-31"))
			.andExpect(status().isUnauthorized());
	}

	// --- 검증 ---

	@Test
	void createRejectsBlankTitle() throws Exception {
		expectCreateInvalid("""
			{"title": "   ", "eventDate": "2026-08-05"}
			""");
	}

	@Test
	void createRejectsTitleLongerThanTwentyCharacters() throws Exception {
		expectCreateInvalid("""
			{"title": "%s", "eventDate": "2026-08-05"}
			""".formatted("가".repeat(21)));
	}

	@Test
	void createRejectsDescriptionLongerThanFiftyCharacters() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "description": "%s", "eventDate": "2026-08-05"}
			""".formatted("설".repeat(51)));
	}

	@Test
	void createRejectsEndAtBeforeStartAt() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "startAt": "2026-08-05T02:00:00Z", "endAt": "2026-08-05T01:00:00Z"}
			""");
	}

	@Test
	void createRejectsEndDateBeforeEventDate() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "eventDate": "2026-08-05", "endDate": "2026-08-04"}
			""");
	}

	@Test
	void createRejectsOnlyOneOfTheTimePair() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "startAt": "2026-08-05T01:00:00Z"}
			""");
		expectCreateInvalid("""
			{"title": "제목", "endAt": "2026-08-05T01:00:00Z"}
			""");
	}

	@Test
	void createRejectsMissingDateAndTime() throws Exception {
		expectCreateInvalid("""
			{"title": "제목"}
			""");
	}

	@Test
	void listRejectsMissingDateParameters() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void listRejectsStartDateAfterEndDate() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", "2026-08-31").param("endDate", "2026-08-01")
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void listRejectsMalformedDateParameter() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", "2026-13-45").param("endDate", "2026-08-31")
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	// --- 참여자 ---

	@Test
	void createRejectsParticipantFromAnotherGroup() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "eventDate": "2026-08-05", "participantMemberIds": [%d]}
			""".formatted(otherGroupMember.getId()));
	}

	@Test
	void createRejectsInactiveParticipant() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "eventDate": "2026-08-05", "participantMemberIds": [%d]}
			""".formatted(leftMember.getId()));
	}

	@Test
	void createRejectsUnknownParticipant() throws Exception {
		expectCreateInvalid("""
			{"title": "제목", "eventDate": "2026-08-05", "participantMemberIds": [%d]}
			""".formatted(UNKNOWN_ID));
	}

	@Test
	void createDeduplicatesRepeatedParticipants() throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "제목", "eventDate": "2026-08-05", "participantMemberIds": [%d, %d]}
					""".formatted(memberMember.getId(), memberMember.getId())))
			.andExpect(status().isCreated());

		Long eventId = calendarEventRepository.findAll().get(0).getId();
		assertThat(eventParticipantRepository.findMemberIdsByEventId(eventId))
			.containsExactly(memberMember.getId());
	}

	@Test
	void createAcceptsNullAndEmptyParticipants() throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "참여자 없음", "eventDate": "2026-08-05", "participantMemberIds": null}
					"""))
			.andExpect(status().isCreated());
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "빈 참여자", "eventDate": "2026-08-06", "participantMemberIds": []}
					"""))
			.andExpect(status().isCreated());

		assertThat(calendarEventRepository.findAll()).hasSize(2);
		assertThat(eventParticipantRepository.count()).isZero();
	}

	@Test
	void updateReplacesParticipantsCompletely() throws Exception {
		Long eventId = persistAllDayEvent("일정", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));
		persistParticipants(eventId, memberMember, creatorMember);

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "일정", "eventDate": "2026-08-05", "participantMemberIds": [%d, %d]}
					""".formatted(creatorMember.getId(), managerMember.getId())))
			.andExpect(status().isOk());

		entityManager.flush();
		entityManager.clear();
		assertThat(eventParticipantRepository.findMemberIdsByEventId(eventId))
			.containsExactlyInAnyOrder(creatorMember.getId(), managerMember.getId());
		assertThat(eventParticipantRepository.count()).isEqualTo(2);
	}

	/**
	 * 본체 필드는 그대로 두고 참여자만 바꾼 수정도 {@code updatedAt}에 반영되어야 한다.
	 *
	 * <p>더티 체킹만 믿으면 본체가 변하지 않아 UPDATE가 생략되고 수정 시각이 등록 시각에 머문다.
	 */
	@Test
	void participantOnlyUpdateStillAdvancesUpdatedAt() throws Exception {
		Long eventId = persistAllDayEvent("일정", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));
		persistParticipants(eventId, memberMember);
		Instant createdAt = calendarEventRepository.findById(eventId).orElseThrow().getUpdatedAt();

		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "일정", "eventDate": "2026-08-05", "participantMemberIds": [%d]}
					""".formatted(managerMember.getId())))
			.andExpect(status().isOk());

		entityManager.flush();
		entityManager.clear();
		Instant updatedAt = calendarEventRepository.findById(eventId).orElseThrow().getUpdatedAt();
		assertThat(updatedAt).isAfter(createdAt);
	}

	@Test
	void listExposesInstantsForTimedEvent() throws Exception {
		createTimedEvent("2026-08-05T01:00:00Z", "2026-08-05T02:00:00Z");

		mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", "2026-08-05")
				.param("endDate", "2026-08-05")
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.events[0].startAt").value("2026-08-05T01:00:00Z"))
			.andExpect(jsonPath("$.data.events[0].endAt").value("2026-08-05T02:00:00Z"))
			.andExpect(jsonPath("$.data.events[0].eventDate").value("2026-08-05"))
			.andExpect(jsonPath("$.data.events[0].endDate").value("2026-08-05"));
	}

	/**
	 * 수정 요청이 검증에 걸리면 기존 일정이 그대로 남아야 한다.
	 */
	@Test
	void rejectedUpdateLeavesEventUnchanged() throws Exception {
		Long eventId = persistAllDayEvent("원본", LocalDate.of(2026, 8, 5), LocalDate.of(2026, 8, 5));

		expectUpdateInvalid(eventId, """
			{"title": "뒤집힌 시각", "startAt": "2026-08-05T02:00:00Z", "endAt": "2026-08-05T01:00:00Z"}
			""");
		expectUpdateInvalid(eventId, """
			{"title": "한쪽만", "startAt": "2026-08-05T01:00:00Z"}
			""");
		expectUpdateInvalid(eventId, """
			{"title": "타그룹 참여자", "eventDate": "2026-08-05", "participantMemberIds": [%d]}
			""".formatted(otherGroupMember.getId()));

		entityManager.clear();
		CalendarEvent unchanged = calendarEventRepository.findById(eventId).orElseThrow();
		assertThat(unchanged.getTitle()).isEqualTo("원본");
		assertThat(unchanged.getStartAt()).isNull();
		assertThat(unchanged.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 5));
	}

	/**
	 * 종료 시각이 정확히 KST 자정이면 파생 종료 날짜가 다음 날이 된다.
	 *
	 * <p>승인된 파생 규칙({@code end_at}의 KST 날짜)의 직접적인 귀결이므로 경계값으로 고정한다.
	 */
	@Test
	void timedEventEndingExactlyAtKstMidnightDerivesNextDate() throws Exception {
		Long eventId = createTimedEvent("2026-08-05T13:00:00Z", "2026-08-05T15:00:00Z");

		CalendarEvent saved = calendarEventRepository.findById(eventId).orElseThrow();
		assertThat(saved.getEventDate()).isEqualTo(LocalDate.of(2026, 8, 5));
		assertThat(saved.getEndDate()).isEqualTo(LocalDate.of(2026, 8, 6));
	}

	// --- 헬퍼 ---

	private void expectUpdateInvalid(Long eventId, String body) throws Exception {
		mockMvc.perform(patch("/events/{eventId}", eventId)
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	private List<String> listTitles(String startDate, String endDate) throws Exception {
		String body = mockMvc.perform(get("/groups/{groupId}/events", group.getId())
				.param("startDate", startDate)
				.param("endDate", endDate)
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.data.events[*].title");
	}

	private Long createTimedEvent(String startAt, String endAt) throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"title": "시간 일정", "startAt": "%s", "endAt": "%s"}
					""".formatted(startAt, endAt)))
			.andExpect(status().isCreated());
		entityManager.flush();
		entityManager.clear();
		return calendarEventRepository.findAll().get(0).getId();
	}

	private void expectCreateInvalid(String body) throws Exception {
		mockMvc.perform(post("/groups/{groupId}/events", group.getId())
				.with(authenticatedAs(creatorUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	private Long persistAllDayEvent(String title, LocalDate eventDate, LocalDate endDate) {
		return persistAllDayEventIn(group, creatorMember, title, eventDate, endDate);
	}

	private Long persistAllDayEventIn(
		FamilyGroup targetGroup, GroupMember creator, String title, LocalDate eventDate, LocalDate endDate) {
		CalendarEvent event = calendarEventRepository.save(
			new CalendarEvent(targetGroup, creator, title, null, eventDate, endDate, null, null));
		entityManager.flush();
		entityManager.clear();
		return event.getId();
	}

	private void persistTimedEvent(String title, Instant startAt, Instant endAt) {
		calendarEventRepository.save(new CalendarEvent(
			group,
			creatorMember,
			title,
			null,
			LocalDate.ofInstant(startAt, BUSINESS_ZONE),
			LocalDate.ofInstant(endAt, BUSINESS_ZONE),
			startAt,
			endAt));
		entityManager.flush();
		entityManager.clear();
	}

	private void persistParticipants(Long eventId, GroupMember... members) {
		CalendarEvent event = calendarEventRepository.findById(eventId).orElseThrow();
		for (GroupMember member : members) {
			eventParticipantRepository.save(new EventParticipant(event, member));
		}
		entityManager.flush();
		entityManager.clear();
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}
}
