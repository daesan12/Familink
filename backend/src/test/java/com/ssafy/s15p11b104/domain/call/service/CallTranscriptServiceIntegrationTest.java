package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.support.IntegrationTest;

class CallTranscriptServiceIntegrationTest extends IntegrationTest {

	@Autowired
	private CallTranscriptService callTranscriptService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	@Transactional
	void deduplicatesItemsWithinSessionAndAllowsSameItemInDifferentSession() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		Long firstSessionId = insertCompletedSession(groupId, memberId);
		Long secondSessionId = insertCompletedSession(groupId, memberId);

		boolean firstSaved = callTranscriptService.saveIfAbsent(
			firstSessionId,
			SpeakerType.USER,
			"첫 통화",
			1,
			"shared-item"
		);
		boolean duplicateSaved = callTranscriptService.saveIfAbsent(
			firstSessionId,
			SpeakerType.USER,
			"중복 통화",
			2,
			"shared-item"
		);
		boolean secondSaved = callTranscriptService.saveIfAbsent(
			secondSessionId,
			SpeakerType.ASSISTANT,
			"둘째 통화",
			1,
			"shared-item"
		);

		assertThat(firstSaved).isTrue();
		assertThat(duplicateSaved).isFalse();
		assertThat(secondSaved).isTrue();
		assertThat(jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM call_transcripts WHERE openai_item_id = 'shared-item'",
			Integer.class
		)).isEqualTo(2);
		assertThat(jdbcTemplate.queryForObject(
			"SELECT speaker::text FROM call_transcripts WHERE call_session_id = ?",
			String.class,
			secondSessionId
		)).isEqualTo("ASSISTANT");
	}

	private Long insertGroup() {
		return jdbcTemplate.queryForObject("""
			INSERT INTO family_groups (name, invite_code)
			VALUES ('전사 테스트 가족', 'TRS001')
			RETURNING id
			""", Long.class);
	}

	private Long insertCareReceiver(Long groupId) {
		Long userId = jdbcTemplate.queryForObject("""
			INSERT INTO users (login_id, password_hash, name, birth_date, gender)
			VALUES ('transcript-user', 'unused', '테스트', DATE '1950-01-01', 'FEMALE')
			RETURNING id
			""", Long.class);
		return jdbcTemplate.queryForObject("""
			INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at)
			VALUES (?, ?, 'CARE_RECEIVER', FALSE, CURRENT_TIMESTAMP)
			RETURNING id
			""", Long.class, groupId, userId);
	}

	private Long insertCompletedSession(Long groupId, Long memberId) {
		return jdbcTemplate.queryForObject("""
			INSERT INTO call_sessions (
				group_id,
				care_receiver_member_id,
				persona_id,
				status,
				ended_at
			)
			VALUES (?, ?, 1, 'COMPLETED', CURRENT_TIMESTAMP)
			RETURNING id
			""", Long.class, groupId, memberId);
	}
}
