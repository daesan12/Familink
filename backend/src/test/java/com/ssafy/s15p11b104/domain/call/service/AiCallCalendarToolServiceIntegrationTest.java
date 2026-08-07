package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.support.IntegrationTest;

/**
 * 모델이 계산한 절대 날짜를 그대로 받으므로 애플리케이션 시계를 고정하지 않아도 실행일과
 * 무관하게 같은 결과가 나온다. 여기서 확인하는 것은 기간 겹침 판정과 그룹 범위다.
 */
@Transactional
class AiCallCalendarToolServiceIntegrationTest extends IntegrationTest {

	/** 픽스처 감사 컬럼용 고정 시각. 조회 결과에는 영향을 주지 않는다. */
	private static final Instant FIXED_NOW = Instant.parse("2026-08-02T00:00:00Z");

	private static final String RANGE_START = "2026-08-02";
	private static final String RANGE_END = "2026-08-04";
	private static final String BEFORE_RANGE = "2026-07-30";
	private static final String RANGE_START_EVE = "2026-07-31";
	private static final String INSIDE_RANGE = "2026-08-03";
	private static final String AFTER_RANGE = "2026-08-05";

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private AiCallCalendarToolService calendarToolService;

	@Test
	void returnsOnlyCurrentGroupEventsOverlappingRequestedRange() {
		Long groupId = insertGroup("캘린더그룹", "CAL01");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("cal_recv", "피보호자"),
			"CARE_RECEIVER"
		);
		Long creatorId = insertMember(
			groupId,
			insertUser("cal_create", "보호자"),
			"GUARDIAN"
		);
		Long otherGroupId = insertGroup("다른그룹", "CAL02");
		Long otherCreatorId = insertMember(
			otherGroupId,
			insertUser("cal_other", "외부인"),
			"GUARDIAN"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "IN_PROGRESS");

		insertCalendarEvent(groupId, creatorId, "기간 안 하루 일정", INSIDE_RANGE, INSIDE_RANGE);
		insertCalendarEvent(groupId, creatorId, "시작 경계만 겹치는 일정", RANGE_START_EVE, RANGE_START);
		insertCalendarEvent(groupId, creatorId, "기간 뒤 일정", AFTER_RANGE, AFTER_RANGE);
		insertCalendarEvent(groupId, creatorId, "기간 앞 일정", BEFORE_RANGE, RANGE_START_EVE);
		insertCalendarEvent(otherGroupId, otherCreatorId, "외부 그룹", INSIDE_RANGE, INSIDE_RANGE);

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			callSessionId, RANGE_START, RANGE_END);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		assertThat(result.startDate()).isEqualTo(RANGE_START);
		assertThat(result.endDate()).isEqualTo(RANGE_END);
		assertThat(result.events()).extracting(AiCallToolResult.CalendarEventItem::title)
			.containsExactlyInAnyOrder("기간 안 하루 일정", "시작 경계만 겹치는 일정");
	}

	/** 하루 조회는 시작일과 종료일이 같은 기간 조회로 표현한다. */
	@Test
	void returnsEventsForSingleDayWhenStartEqualsEnd() {
		Long groupId = insertGroup("하루 조회", "CAL03");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("cal_single", "피보호자"),
			"CARE_RECEIVER"
		);
		Long creatorId = insertMember(
			groupId,
			insertUser("cal_sgl_make", "보호자"),
			"GUARDIAN"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "IN_PROGRESS");

		insertCalendarEvent(groupId, creatorId, "그날 일정", RANGE_START, RANGE_START);
		insertCalendarEvent(groupId, creatorId, "그날 걸친 일정", RANGE_START_EVE, INSIDE_RANGE);
		insertCalendarEvent(groupId, creatorId, "다음 날 일정", INSIDE_RANGE, INSIDE_RANGE);

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			callSessionId, RANGE_START, RANGE_START);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		assertThat(result.startDate()).isEqualTo(RANGE_START);
		assertThat(result.endDate()).isEqualTo(RANGE_START);
		assertThat(result.events()).extracting(AiCallToolResult.CalendarEventItem::title)
			.containsExactlyInAnyOrder("그날 일정", "그날 걸친 일정");
	}

	/**
	 * 모델이 음성 안내의 표시 계층이므로 시각은 UTC가 아니라 `Asia/Seoul` 기준으로 넘겨야 한다.
	 * 설명과 참여자는 일반 목록 응답에 없어 보충 조회로 채운다.
	 */
	@Test
	void returnsDescriptionParticipantsAndBusinessZoneTimes() {
		Long groupId = insertGroup("상세 정보", "CAL05");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("cal_detail", "피보호자"),
			"CARE_RECEIVER"
		);
		Long participantId = insertMember(
			groupId,
			insertUser("cal_part", "김민지"),
			"GUARDIAN"
		);
		Long leftMemberId = insertMember(
			groupId,
			insertUser("cal_left", "떠난사람"),
			"GUARDIAN"
		);
		jdbcTemplate.update("update group_members set left_at = current_timestamp where id = ?", leftMemberId);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "IN_PROGRESS");

		// 한국 시간 2026-08-02 14:00~15:00
		Long timedEventId = insertTimedCalendarEvent(
			groupId,
			participantId,
			"병원 진료",
			"3층 정형외과",
			RANGE_START,
			Instant.parse("2026-08-02T05:00:00Z"),
			Instant.parse("2026-08-02T06:00:00Z"));
		insertParticipant(timedEventId, participantId);
		insertParticipant(timedEventId, leftMemberId);

		Long allDayEventId = insertCalendarEvent(groupId, participantId, "하루종일 일정", RANGE_START, RANGE_START);

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			callSessionId, RANGE_START, RANGE_START);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);

		AiCallToolResult.CalendarEventItem timedEvent = findEvent(result, timedEventId);
		assertThat(timedEvent.description()).isEqualTo("3층 정형외과");
		assertThat(timedEvent.startAt()).isEqualTo("2026-08-02T14:00+09:00");
		assertThat(timedEvent.endAt()).isEqualTo("2026-08-02T15:00+09:00");
		// 그룹을 떠난 구성원은 참여자에서 제외한다.
		assertThat(timedEvent.participants()).containsExactly("김민지");

		AiCallToolResult.CalendarEventItem allDayEvent = findEvent(result, allDayEventId);
		assertThat(allDayEvent.description()).isNull();
		assertThat(allDayEvent.startAt()).isNull();
		assertThat(allDayEvent.endAt()).isNull();
		assertThat(allDayEvent.participants()).isEmpty();
	}

	private AiCallToolResult.CalendarEventItem findEvent(AiCallToolResult result, Long eventId) {
		return result.events().stream()
			.filter(event -> event.id().equals(eventId))
			.findFirst()
			.orElseThrow(() -> new AssertionError("일정 " + eventId + "이 결과에 없습니다."));
	}

	@Test
	void rejectsTerminalCallSession() {
		Long groupId = insertGroup("종료 통화", "CAL04");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("cal_ended", "피보호자"),
			"CARE_RECEIVER"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "COMPLETED");

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			callSessionId, RANGE_START, RANGE_START);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
	}

	private Long insertGroup(String name, String inviteCode) {
		return jdbcTemplate.queryForObject("""
			insert into family_groups (name, invite_code)
			values (?, ?)
			returning id
			""", Long.class, name, inviteCode);
	}

	private Long insertUser(String loginId, String name) {
		return jdbcTemplate.queryForObject("""
			insert into users (login_id, password_hash, name, birth_date, gender)
			values (?, 'unused', ?, date '1950-01-01', 'FEMALE')
			returning id
			""", Long.class, loginId, name);
	}

	private Long insertMember(Long groupId, Long userId, String role) {
		return jdbcTemplate.queryForObject("""
			insert into group_members (group_id, user_id, role, is_manager, joined_at)
			values (?, ?, cast(? as group_role), false, current_timestamp)
			returning id
			""", Long.class, groupId, userId, role);
	}

	private Long insertCallSession(Long groupId, Long careReceiverId, String status) {
		return jdbcTemplate.queryForObject("""
			insert into call_sessions (
				group_id,
				care_receiver_member_id,
				persona_id,
				status
			)
			values (?, ?, 1, cast(? as call_status))
			returning id
			""", Long.class, groupId, careReceiverId, status);
	}

	private Long insertCalendarEvent(
		Long groupId,
		Long creatorMemberId,
		String title,
		String eventDate,
		String endDate
	) {
		return jdbcTemplate.queryForObject("""
			insert into calendar_events (
				group_id,
				creator_member_id,
				last_editor_member_id,
				title,
				event_date,
				end_date,
				created_at,
				updated_at,
				reminder_schedule_updated_at
			)
			values (?, ?, ?, ?, ?, ?, ?, ?, ?)
			returning id
			""",
			Long.class,
			groupId,
			creatorMemberId,
			creatorMemberId,
			title,
			Date.valueOf(eventDate),
			Date.valueOf(endDate),
			Timestamp.from(FIXED_NOW),
			Timestamp.from(FIXED_NOW),
			Timestamp.from(FIXED_NOW));
	}

	private Long insertTimedCalendarEvent(
		Long groupId,
		Long creatorMemberId,
		String title,
		String description,
		String eventDate,
		Instant startAt,
		Instant endAt
	) {
		return jdbcTemplate.queryForObject("""
			insert into calendar_events (
				group_id,
				creator_member_id,
				last_editor_member_id,
				title,
				description,
				event_date,
				end_date,
				start_at,
				end_at,
				participants_specified,
				created_at,
				updated_at,
				reminder_schedule_updated_at
			)
			values (?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?)
			returning id
			""",
			Long.class,
			groupId,
			creatorMemberId,
			creatorMemberId,
			title,
			description,
			Date.valueOf(eventDate),
			Date.valueOf(eventDate),
			Timestamp.from(startAt),
			Timestamp.from(endAt),
			Timestamp.from(FIXED_NOW),
			Timestamp.from(FIXED_NOW),
			Timestamp.from(FIXED_NOW));
	}

	private void insertParticipant(Long eventId, Long groupMemberId) {
		jdbcTemplate.update("""
			insert into event_participants (event_id, group_member_id)
			values (?, ?)
			""", eventId, groupMemberId);
	}
}
