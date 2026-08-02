package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.support.IntegrationTest;

class CallTranscriptServiceIntegrationTest extends IntegrationTest {

	private static final String LOGIN_ID = "transcript-user";
	private static final String INVITE_CODE = "TRS001";
	private static final String ZERO_HASH = "0".repeat(64);

	@Autowired
	private CallTranscriptService callTranscriptService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void setUp() {
		cleanFixture();
	}

	@AfterEach
	void tearDown() {
		cleanFixture();
	}

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

	@Test
	void allocatesSequenceFromPersistedTranscriptAndLedgerState() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		Long callSessionId = insertInProgressSession(groupId, memberId);
		callTranscriptService.saveIfAbsent(
			callSessionId,
			SpeakerType.USER,
			"persisted transcript",
			3,
			"persisted-item"
		);

		CallTranscriptService.TranscriptReservation first = callTranscriptService.reserveItem(
			callSessionId,
			SpeakerType.USER,
			"restart-item-1"
		);
		CallTranscriptService.TranscriptReservation second = callTranscriptService.reserveItem(
			callSessionId,
			SpeakerType.ASSISTANT,
			"restart-item-2"
		);

		assertThat(first.sequenceNumber()).isEqualTo(4);
		assertThat(second.sequenceNumber()).isEqualTo(5);
		assertThat(jdbcTemplate.queryForList(
			"""
				SELECT sequence
				FROM call_transcript_events
				WHERE call_session_id = ?
				ORDER BY sequence
				""",
			Integer.class,
			callSessionId
		)).containsExactly(4, 5);
	}

	@Test
	void reconcilesCommittedReadyEventIntoTranscript() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		Long callSessionId = insertInProgressSession(groupId, memberId);
		CallTranscriptService.TranscriptReservation reservation = callTranscriptService.reserveItem(
			callSessionId,
			SpeakerType.USER,
			"ready-item"
		);
		jdbcTemplate.update(
			"""
				UPDATE call_transcript_events
				SET status = 'READY', content = 'recovered transcript', content_hash = ?,
					ready_at = CURRENT_TIMESTAMP, next_attempt_at = CURRENT_TIMESTAMP,
					updated_at = CURRENT_TIMESTAMP
				WHERE call_session_id = ? AND openai_item_id = 'ready-item'
				""",
			ZERO_HASH,
			callSessionId);

		callTranscriptService.reconcileReady();

		assertThat(reservation.sequenceNumber()).isEqualTo(1);
		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT status::text AS status, attempt_count, content IS NULL AS payload_removed
				FROM call_transcript_events
				WHERE call_session_id = ? AND openai_item_id = 'ready-item'
				""",
			callSessionId
		)).containsEntry("status", "APPLIED")
			.containsEntry("attempt_count", 1)
			.containsEntry("payload_removed", true);
		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT speaker::text AS speaker, content, sequence
				FROM call_transcripts
				WHERE call_session_id = ? AND openai_item_id = 'ready-item'
				""",
			callSessionId
		)).containsEntry("speaker", "USER")
			.containsEntry("content", "recovered transcript")
			.containsEntry("sequence", 1);
	}

	@Test
	void promotesReconciledSessionAndCreatesDurableReportRequest() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		Long callSessionId = insertCompletedSession(groupId, memberId);
		callTranscriptService.reserveItem(callSessionId, SpeakerType.USER, "finalize-item");
		jdbcTemplate.update(
			"""
				UPDATE call_transcript_events
				SET status = 'READY', content = 'final transcript', content_hash = ?,
					ready_at = CURRENT_TIMESTAMP, next_attempt_at = CURRENT_TIMESTAMP,
					updated_at = CURRENT_TIMESTAMP
				WHERE call_session_id = ? AND openai_item_id = 'finalize-item'
				""",
			ZERO_HASH,
			callSessionId);

		assertThat(callTranscriptService.finalizeSession(callSessionId, true)).isFalse();
		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT transcript_integrity_status::text AS integrity_status,
					transcript_finalized_at IS NOT NULL AS finalized
				FROM call_sessions
				WHERE id = ?
				""",
			callSessionId
		)).containsEntry("integrity_status", "RECONCILIATION_REQUIRED")
			.containsEntry("finalized", true);
		assertThat(jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM call_report_generation_requests WHERE call_session_id = ?",
			Integer.class,
			callSessionId
		)).isZero();

		callTranscriptService.reconcileReady();

		Map<String, Object> recoveredState = jdbcTemplate.queryForMap(
			"""
				SELECT session.transcript_integrity_status::text AS integrity_status,
					session.transcript_revision, request.status::text AS request_status,
					request.input_revision
				FROM call_sessions session
				JOIN call_report_generation_requests request ON request.call_session_id = session.id
				WHERE session.id = ?
				""",
			callSessionId);
		assertThat(recoveredState)
			.containsEntry("integrity_status", "COMPLETE")
			.containsEntry("request_status", "PENDING");
		assertThat(recoveredState.get("input_revision"))
			.isEqualTo(recoveredState.get("transcript_revision"));
	}

	@Test
	void watchdogDoesNotStarveCollectingSessionBehindReconciliationRows() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		for (int index = 0; index < 20; index++) {
			Long reconciledSessionId = insertCompletedSession(groupId, memberId);
			jdbcTemplate.update(
				"""
					UPDATE call_sessions
					SET ended_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes',
						transcript_integrity_status = 'RECONCILIATION_REQUIRED'
					WHERE id = ?
					""",
				reconciledSessionId);
		}
		Long collectingSessionId = insertCompletedSession(groupId, memberId);
		jdbcTemplate.update(
			"UPDATE call_sessions SET ended_at = CURRENT_TIMESTAMP - INTERVAL '2 minutes' WHERE id = ?",
			collectingSessionId);

		callTranscriptService.reconcileStaleFinalizations();

		assertThat(jdbcTemplate.queryForObject(
			"SELECT transcript_integrity_status::text FROM call_sessions WHERE id = ?",
			String.class,
			collectingSessionId
		)).isEqualTo("RECONCILIATION_REQUIRED");
	}

	@Test
	void cleanupSkipsPayloadFreeFailedRowsAndExpiresReadyPayload() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		Long callSessionId = insertInProgressSession(groupId, memberId);
		jdbcTemplate.update(
			"""
				INSERT INTO call_transcript_events (
					call_session_id, openai_item_id, speaker, sequence, status,
					failure_code, created_at, updated_at
				)
				SELECT ?, 'failed-item-' || value, 'USER', value, 'FAILED',
					'PROVIDER_FAILED', CURRENT_TIMESTAMP - INTERVAL '25 hours',
					CURRENT_TIMESTAMP - INTERVAL '25 hours'
				FROM generate_series(1, 100) value
				""",
			callSessionId);
		jdbcTemplate.update(
			"""
				INSERT INTO call_transcript_events (
					call_session_id, openai_item_id, speaker, sequence, status,
					content, content_hash, ready_at, next_attempt_at, created_at, updated_at
				)
				VALUES (?, 'expired-ready-item', 'USER', 101, 'READY',
					'expired transcript', ?, CURRENT_TIMESTAMP - INTERVAL '25 hours',
					CURRENT_TIMESTAMP - INTERVAL '25 hours', CURRENT_TIMESTAMP - INTERVAL '25 hours',
					CURRENT_TIMESTAMP - INTERVAL '25 hours')
				""",
			callSessionId,
			ZERO_HASH);

		callTranscriptService.cleanupExpiredPayloads();

		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT status::text AS status, content, failure_code
				FROM call_transcript_events
				WHERE call_session_id = ? AND openai_item_id = 'expired-ready-item'
				""",
			callSessionId
		)).containsEntry("status", "FAILED")
			.containsEntry("content", null)
			.containsEntry("failure_code", "PAYLOAD_RETENTION_EXPIRED");
	}

	@Test
	void databaseRejectsReportUntilTranscriptIsFinalizedAndLedgerIsApplied() {
		Long groupId = insertGroup();
		Long memberId = insertCareReceiver(groupId);
		Long callSessionId = insertCompletedSession(groupId, memberId);

		assertReportInsertRejected(callSessionId);

		jdbcTemplate.update(
			"""
				INSERT INTO call_transcript_events (
					call_session_id, openai_item_id, speaker, sequence, status
				)
				VALUES (?, 'unresolved-item', 'USER', 1, 'RESERVED')
				""",
			callSessionId);
		jdbcTemplate.update(
			"""
				UPDATE call_sessions
				SET transcript_integrity_status = 'COMPLETE',
					transcript_finalized_at = CURRENT_TIMESTAMP
				WHERE id = ?
				""",
			callSessionId);

		assertReportInsertRejected(callSessionId);

		jdbcTemplate.update(
			"""
				UPDATE call_transcript_events
				SET status = 'APPLIED', content_hash = ?, applied_at = CURRENT_TIMESTAMP,
					updated_at = CURRENT_TIMESTAMP
				WHERE call_session_id = ? AND openai_item_id = 'unresolved-item'
				""",
			ZERO_HASH,
			callSessionId);
		jdbcTemplate.update(
			"""
				INSERT INTO call_reports (
					call_session_id, summary, emotion_category, emotion_subcategory
				)
				VALUES (?, 'verified report', 'NEUTRAL', 'CALM')
				""",
			callSessionId);

		assertThat(jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM call_reports WHERE call_session_id = ?",
			Integer.class,
			callSessionId
		)).isEqualTo(1);
	}

	private Long insertGroup() {
		return jdbcTemplate.queryForObject("""
			INSERT INTO family_groups (name, invite_code)
			VALUES ('전사 테스트 가족', 'TRS001')
			RETURNING id
			""", Long.class);
	}

	private Long insertInProgressSession(Long groupId, Long memberId) {
		return jdbcTemplate.queryForObject("""
			INSERT INTO call_sessions (
				group_id, care_receiver_member_id, persona_id, status, started_at, lease_expires_at
			)
			VALUES (?, ?, 1, 'IN_PROGRESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '90 seconds')
			RETURNING id
			""", Long.class, groupId, memberId);
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

	private void assertReportInsertRejected(Long callSessionId) {
		assertThatThrownBy(() -> jdbcTemplate.update(
			"""
				INSERT INTO call_reports (
					call_session_id, summary, emotion_category, emotion_subcategory
				)
				VALUES (?, 'blocked report', 'NEUTRAL', 'CALM')
				""",
			callSessionId
		)).isInstanceOf(DataAccessException.class);
	}

	private void cleanFixture() {
		jdbcTemplate.update("""
			DELETE FROM call_sessions
			WHERE care_receiver_member_id IN (
				SELECT member.id
				FROM group_members member
				JOIN users user_account ON user_account.id = member.user_id
				WHERE user_account.login_id = ?
			)
			""", LOGIN_ID);
		jdbcTemplate.update("DELETE FROM group_members WHERE user_id IN (SELECT id FROM users WHERE login_id = ?)", LOGIN_ID);
		jdbcTemplate.update("DELETE FROM users WHERE login_id = ?", LOGIN_ID);
		jdbcTemplate.update("DELETE FROM family_groups WHERE invite_code = ?", INVITE_CODE);
	}
}
