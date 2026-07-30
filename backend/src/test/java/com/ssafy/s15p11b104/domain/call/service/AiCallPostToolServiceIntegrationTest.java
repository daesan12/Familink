package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.support.IntegrationTest;

@Transactional
class AiCallPostToolServiceIntegrationTest extends IntegrationTest {

	private static final Instant POSTED_AT = Instant.parse("2026-07-29T12:00:00Z");

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private AiCallPostToolService postToolService;

	@Test
	void returnsLatestFiveSuccessfulSummariesForOnlyTheMappedPerson() {
		Long groupId = insertGroup("도구그룹", "TOOL01");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("tool_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long targetMemberId = insertMember(
			groupId,
			insertUser("tool_target", "민지"),
			"GUARDIAN"
		);
		Long otherMemberId = insertMember(
			groupId,
			insertUser("tool_other", "준호"),
			"GUARDIAN"
		);
		Long otherGroupId = insertGroup("다른그룹", "TOOL02");
		Long otherGroupMemberId = insertMember(
			otherGroupId,
			insertUser("tool_outside", "외부인"),
			"GUARDIAN"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "IN_PROGRESS");

		for (int index = 1; index <= 6; index++) {
			insertPostAnalysis(groupId, targetMemberId, "대상 " + index, POSTED_AT, "SUCCESS", "대상 " + index);
		}
		insertPostAnalysis(
			groupId,
			otherMemberId,
			"다른 작성자",
			POSTED_AT.plusSeconds(60),
			"SUCCESS",
			"다른 작성자"
		);
		insertPostAnalysis(
			groupId,
			targetMemberId,
			"분석 대기",
			POSTED_AT.plusSeconds(120),
			"PENDING",
			null
		);
		insertPostAnalysis(
			otherGroupId,
			otherGroupMemberId,
			"다른 그룹",
			POSTED_AT.plusSeconds(180),
			"SUCCESS",
			"다른 그룹"
		);

		AiCallToolResult result = postToolService.getRecentPostSummaries(
			callSessionId,
			"person_1",
			new AiCallPersonReference(targetMemberId, "민지", "큰딸")
		);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		assertThat(result.personKey()).isEqualTo("person_1");
		assertThat(result.name()).isEqualTo("민지");
		assertThat(result.displayName()).isEqualTo("큰딸");
		assertThat(result.summaries()).containsExactly("대상 6", "대상 5", "대상 4", "대상 3", "대상 2");
	}

	@Test
	void returnsSuccessWithEmptySummariesWhenThePersonHasNoAnalyzedPosts() {
		Long groupId = insertGroup("빈결과", "EMPTY1");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("empty_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long targetMemberId = insertMember(
			groupId,
			insertUser("empty_target", "민지"),
			"GUARDIAN"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "CONNECTING");

		AiCallToolResult result = postToolService.getRecentPostSummaries(
			callSessionId,
			"person_1",
			new AiCallPersonReference(targetMemberId, "민지", "딸")
		);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		assertThat(result.summaries()).isEmpty();
	}

	@Test
	void rejectsTerminalCallSession() {
		Long groupId = insertGroup("종료통화", "ENDED1");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("ended_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long targetMemberId = insertMember(
			groupId,
			insertUser("ended_target", "민지"),
			"GUARDIAN"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "COMPLETED");

		AiCallToolResult result = postToolService.getRecentPostSummaries(
			callSessionId,
			"person_1",
			new AiCallPersonReference(targetMemberId, "민지", "딸")
		);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
	}

	@Test
	void rejectsPersonWhoLeftTheCurrentGroup() {
		Long groupId = insertGroup("탈퇴구성", "LEFT01");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("left_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long targetMemberId = insertMember(
			groupId,
			insertUser("left_target", "민지"),
			"GUARDIAN"
		);
		Long callSessionId = insertCallSession(groupId, careReceiverId, "IN_PROGRESS");
		jdbcTemplate.update(
			"update group_members set left_at = current_timestamp where id = ?",
			targetMemberId
		);

		AiCallToolResult result = postToolService.getRecentPostSummaries(
			callSessionId,
			"person_1",
			new AiCallPersonReference(targetMemberId, "민지", "딸")
		);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.PERSON_NOT_AVAILABLE);
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

	private void insertPostAnalysis(
		Long groupId,
		Long authorId,
		String content,
		Instant createdAt,
		String status,
		String summary
	) {
		Long postId = jdbcTemplate.queryForObject("""
			insert into posts (group_id, author_member_id, content, created_at, updated_at)
			values (?, ?, ?, ?, ?)
			returning id
			""", Long.class, groupId, authorId, content, Timestamp.from(createdAt), Timestamp.from(createdAt));
		Timestamp analyzedAt = summary == null ? null : Timestamp.from(createdAt);
		jdbcTemplate.update("""
			insert into post_analyses (post_id, status, summary, analyzed_at)
			values (?, cast(? as analysis_status), ?, ?)
			""", postId, status, summary, analyzedAt);
	}
}
