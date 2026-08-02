package com.ssafy.s15p11b104.domain.call.repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CallTranscriptEventClaimStore {

	private static final String CLAIM_READY_SQL = """
		WITH session_candidates AS MATERIALIZED (
			SELECT session.id
			FROM call_sessions session
			WHERE EXISTS (
				SELECT 1
				FROM call_transcript_events event
				WHERE event.call_session_id = session.id
					AND event.status = 'READY'
					AND event.attempt_count < 3
					AND (event.next_attempt_at IS NULL OR event.next_attempt_at <= ?)
					AND (event.claim_expires_at IS NULL OR event.claim_expires_at <= ?)
			)
			ORDER BY session.id
			FOR UPDATE OF session SKIP LOCKED
			LIMIT ?
		),
		candidates AS MATERIALIZED (
			SELECT event.id
			FROM call_transcript_events event
			JOIN session_candidates session ON session.id = event.call_session_id
			WHERE event.status = 'READY'
				AND event.attempt_count < 3
				AND (event.next_attempt_at IS NULL OR event.next_attempt_at <= ?)
				AND (event.claim_expires_at IS NULL OR event.claim_expires_at <= ?)
			ORDER BY event.id
			FOR UPDATE OF event SKIP LOCKED
			LIMIT ?
		)
		UPDATE call_transcript_events event
		SET claim_token = ?,
			claim_expires_at = ?,
			attempt_count = event.attempt_count + 1,
			updated_at = ?
		FROM candidates
		WHERE event.id = candidates.id
		RETURNING event.id
		""";

	private final JdbcTemplate jdbcTemplate;

	public CallTranscriptEventClaimStore(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	public List<Long> claimReady(
		Instant now,
		UUID claimToken,
		Instant claimExpiresAt,
		int batchSize
	) {
		Timestamp claimedAt = Timestamp.from(now);
		Timestamp expiresAt = Timestamp.from(claimExpiresAt);
		return jdbcTemplate.queryForList(
			CLAIM_READY_SQL,
			Long.class,
			claimedAt,
			claimedAt,
			batchSize,
			claimedAt,
			claimedAt,
			batchSize,
			claimToken,
			expiresAt,
			claimedAt
		);
	}
}
