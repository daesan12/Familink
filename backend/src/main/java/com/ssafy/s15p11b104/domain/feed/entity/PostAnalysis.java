package com.ssafy.s15p11b104.domain.feed.entity;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "post_analyses")
public class PostAnalysis extends CreatedAtEntity {

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "post_id", nullable = false, unique = true)
	private Post post;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "analysis_status")
	private AnalysisStatus status;

	@Column(length = 500)
	private String summary;

	@Column(name = "analyzed_at")
	private Instant analyzedAt;

	@Column(name = "attempt_count", nullable = false)
	private int attemptCount;

	@Column(name = "next_attempt_at")
	private Instant nextAttemptAt;

	@Column(name = "last_failure_code", length = 50)
	private String lastFailureCode;

	@Column(name = "last_failed_at")
	private Instant lastFailedAt;

	@Column(name = "input_updated_at")
	private Instant inputUpdatedAt;

	@JdbcTypeCode(SqlTypes.UUID)
	@Column(name = "claim_token", columnDefinition = "uuid")
	private UUID claimToken;

	@Column(name = "claim_expires_at")
	private Instant claimExpiresAt;

	protected PostAnalysis() {
	}

	public PostAnalysis(Post post, AnalysisStatus status) {
		this.post = post;
		this.status = status;
	}

	public Post getPost() {
		return post;
	}

	public AnalysisStatus getStatus() {
		return status;
	}

	public String getSummary() {
		return summary;
	}

	public Instant getAnalyzedAt() {
		return analyzedAt;
	}

	public int getAttemptCount() {
		return attemptCount;
	}

	public Instant getNextAttemptAt() {
		return nextAttemptAt;
	}

	public String getLastFailureCode() {
		return lastFailureCode;
	}

	public Instant getLastFailedAt() {
		return lastFailedAt;
	}

	public Instant getInputUpdatedAt() {
		return inputUpdatedAt;
	}

	public UUID getClaimToken() {
		return claimToken;
	}

	public Instant getClaimExpiresAt() {
		return claimExpiresAt;
	}

	public boolean isEligible(Instant now, int maxAttempts) {
		if (status == AnalysisStatus.SUCCESS || attemptCount >= maxAttempts) {
			return false;
		}
		if (claimExpiresAt != null && claimExpiresAt.isAfter(now)) {
			return false;
		}
		return status == AnalysisStatus.PENDING
			|| (status == AnalysisStatus.FAILED
				&& nextAttemptAt != null
				&& !nextAttemptAt.isAfter(now));
	}

	public boolean hasExpiredExhaustedClaim(Instant now, int maxAttempts) {
		return status == AnalysisStatus.PENDING
			&& attemptCount >= maxAttempts
			&& claimToken != null
			&& !claimExpiresAt.isAfter(now);
	}

	public void claim(Instant inputUpdatedAt, UUID claimToken, Instant claimExpiresAt) {
		status = AnalysisStatus.PENDING;
		summary = null;
		analyzedAt = null;
		attemptCount++;
		nextAttemptAt = null;
		this.inputUpdatedAt = inputUpdatedAt;
		this.claimToken = claimToken;
		this.claimExpiresAt = claimExpiresAt;
	}

	public boolean ownsClaim(UUID token, Instant expectedInputUpdatedAt, Instant now) {
		return claimToken != null
			&& claimToken.equals(token)
			&& inputUpdatedAt.equals(expectedInputUpdatedAt)
			&& claimExpiresAt.isAfter(now);
	}

	public void resetToPending() {
		status = AnalysisStatus.PENDING;
		summary = null;
		analyzedAt = null;
		attemptCount = 0;
		nextAttemptAt = null;
		lastFailureCode = null;
		lastFailedAt = null;
		clearClaim();
	}

	public void complete(String summary, Instant analyzedAt) {
		this.status = AnalysisStatus.SUCCESS;
		this.summary = summary;
		this.analyzedAt = analyzedAt;
		this.nextAttemptAt = null;
		this.lastFailureCode = null;
		this.lastFailedAt = null;
		clearClaim();
	}

	public void fail(String failureCode, Instant failedAt, Instant nextAttemptAt) {
		status = AnalysisStatus.FAILED;
		summary = null;
		analyzedAt = null;
		this.nextAttemptAt = nextAttemptAt;
		this.lastFailureCode = failureCode;
		this.lastFailedAt = failedAt;
		clearClaim();
	}

	private void clearClaim() {
		inputUpdatedAt = null;
		claimToken = null;
		claimExpiresAt = null;
	}
}
