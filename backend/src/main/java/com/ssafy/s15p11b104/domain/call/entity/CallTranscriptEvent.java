package com.ssafy.s15p11b104.domain.call.entity;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "call_transcript_events")
public class CallTranscriptEvent extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "call_session_id", nullable = false)
	private CallSession callSession;

	@Column(name = "openai_item_id", nullable = false, length = 100)
	private String openaiItemId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "speaker_type")
	private SpeakerType speaker;

	@Column(name = "sequence", nullable = false)
	private int sequenceNumber;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "transcript_ingest_status")
	private TranscriptIngestStatus status;

	@Column(name = "attempt_count", nullable = false)
	private int attemptCount;

	@Column(columnDefinition = "TEXT")
	private String content;

	@Column(name = "content_hash", length = 64)
	private String contentHash;

	@Column(name = "next_attempt_at")
	private Instant nextAttemptAt;

	@JdbcTypeCode(SqlTypes.UUID)
	@Column(name = "claim_token", columnDefinition = "uuid")
	private UUID claimToken;

	@Column(name = "claim_expires_at")
	private Instant claimExpiresAt;

	@Column(name = "failure_code", length = 80)
	private String failureCode;

	@Column(name = "ready_at")
	private Instant readyAt;

	@Column(name = "applied_at")
	private Instant appliedAt;

	protected CallTranscriptEvent() {
	}

	public CallTranscriptEvent(
		CallSession callSession,
		String openaiItemId,
		SpeakerType speaker,
		int sequenceNumber
	) {
		this.callSession = callSession;
		this.openaiItemId = openaiItemId;
		this.speaker = speaker;
		this.sequenceNumber = sequenceNumber;
		this.status = TranscriptIngestStatus.RESERVED;
	}

	public CallSession getCallSession() {
		return callSession;
	}

	public String getOpenaiItemId() {
		return openaiItemId;
	}

	public SpeakerType getSpeaker() {
		return speaker;
	}

	public int getSequenceNumber() {
		return sequenceNumber;
	}

	public TranscriptIngestStatus getStatus() {
		return status;
	}

	public int getAttemptCount() {
		return attemptCount;
	}

	public String getContent() {
		return content;
	}

	public String getContentHash() {
		return contentHash;
	}

	public Instant getClaimExpiresAt() {
		return claimExpiresAt;
	}

	public boolean matchesReservation(SpeakerType expectedSpeaker) {
		return speaker == expectedSpeaker;
	}

	public boolean hasContentHash(String expectedHash) {
		return expectedHash != null && expectedHash.equals(contentHash);
	}

	public boolean isApplied() {
		return status == TranscriptIngestStatus.APPLIED;
	}

	public boolean isReady() {
		return status == TranscriptIngestStatus.READY;
	}

	public boolean isFailed() {
		return status == TranscriptIngestStatus.FAILED;
	}

	public void markReady(String transcript, String hash, Instant now) {
		status = TranscriptIngestStatus.READY;
		content = transcript;
		contentHash = hash;
		readyAt = now;
		nextAttemptAt = now;
		clearClaim();
		failureCode = null;
	}

	public boolean canClaim(Instant now) {
		return isReady()
			&& attemptCount < 3
			&& (nextAttemptAt == null || !nextAttemptAt.isAfter(now))
			&& (claimExpiresAt == null || !claimExpiresAt.isAfter(now));
	}

	public void claim(UUID token, Instant expiresAt) {
		attemptCount++;
		claimToken = token;
		claimExpiresAt = expiresAt;
	}

	public boolean ownsClaim(UUID token, Instant now) {
		return isReady()
			&& token != null
			&& token.equals(claimToken)
			&& claimExpiresAt != null
			&& claimExpiresAt.isAfter(now);
	}

	public void markApplied(Instant now) {
		status = TranscriptIngestStatus.APPLIED;
		content = null;
		nextAttemptAt = null;
		appliedAt = now;
		clearClaim();
	}

	public void scheduleRetry(Instant retryAt) {
		nextAttemptAt = retryAt;
		clearClaim();
	}

	public void markFailed(String code) {
		status = TranscriptIngestStatus.FAILED;
		content = null;
		nextAttemptAt = null;
		failureCode = code;
		clearClaim();
	}

	public void clearPayload() {
		content = null;
	}

	private void clearClaim() {
		claimToken = null;
		claimExpiresAt = null;
	}
}
