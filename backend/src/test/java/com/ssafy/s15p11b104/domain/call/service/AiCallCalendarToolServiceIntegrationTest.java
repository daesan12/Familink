package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.support.IntegrationTest;

/**
 * "오늘" 같은 상대 날짜 표현을 다루므로 애플리케이션 시계를 고정한다. 고정하지 않으면 픽스처가
 * 어느 날짜를 "오늘"로 볼지 정할 수 없어, 실행한 날에 따라 결과가 달라진다.
 */
@Transactional
@Import(AiCallCalendarToolServiceIntegrationTest.FixedClockConfiguration.class)
class AiCallCalendarToolServiceIntegrationTest extends IntegrationTest {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	/** 한국 시간 2026-08-02 09:00. 날짜 경계에서 멀어 시간대 변환 실수가 결과를 바꾸지 않는다. */
	private static final Instant FIXED_NOW = Instant.parse("2026-08-02T00:00:00Z");
	private static final String TODAY = "2026-08-02";
	private static final String YESTERDAY = "2026-08-01";
	private static final String TOMORROW = "2026-08-03";
	private static final String DAY_AFTER_TOMORROW = "2026-08-04";

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private AiCallCalendarToolService calendarToolService;

	@Test
	void returnsOnlyCurrentGroupEventsOverlappingResolvedDate() {
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

		insertCalendarEvent(groupId, creatorId, "당일 일정", TODAY, TODAY);
		insertCalendarEvent(groupId, creatorId, "여러 날 일정", YESTERDAY, TOMORROW);
		insertCalendarEvent(groupId, creatorId, "다른 날짜", DAY_AFTER_TOMORROW, DAY_AFTER_TOMORROW);
		insertCalendarEvent(otherGroupId, otherCreatorId, "외부 그룹", TODAY, TODAY);

		AiCallToolResult result = calendarToolService.getEventsByDate(callSessionId, "오늘");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		assertThat(result.date()).isEqualTo(TODAY);
		assertThat(result.events()).extracting(AiCallToolResult.CalendarEventItem::title)
			.containsExactlyInAnyOrder("당일 일정", "여러 날 일정");
	}

	@Test
	void returnsClarificationWithoutQueryForAmbiguousDate() {
		Long groupId = insertGroup("모호한 날짜", "CAL03");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("cal_ambig", "피보호자"),
			"CARE_RECEIVER"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "IN_PROGRESS");

		AiCallToolResult result = calendarToolService.getEventsByDate(callSessionId, "8월 2일");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.NEEDS_CLARIFICATION);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.AMBIGUOUS_DATE);
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

		AiCallToolResult result = calendarToolService.getEventsByDate(callSessionId, "오늘");

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

	private void insertCalendarEvent(
		Long groupId,
		Long creatorMemberId,
		String title,
		String eventDate,
		String endDate
	) {
		jdbcTemplate.update("""
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
			""",
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

	@TestConfiguration(proxyBeanMethods = false)
	static class FixedClockConfiguration {

		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(FIXED_NOW, BUSINESS_ZONE);
		}
	}
}
