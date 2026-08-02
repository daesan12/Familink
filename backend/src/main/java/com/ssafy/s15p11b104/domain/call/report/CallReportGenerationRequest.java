package com.ssafy.s15p11b104.domain.call.report;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "call_report_generation_requests")
public class CallReportGenerationRequest {

	@Id
	@Column(name = "call_session_id")
	private Long callSessionId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "call_report_generation_status")
	private CallReportGenerationStatus status;

	@Column(name = "input_revision", nullable = false)
	private long inputRevision;

	@JdbcTypeCode(SqlTypes.UUID)
	@Column(name = "claim_token", columnDefinition = "uuid")
	private UUID claimToken;

	@Column(name = "claim_expires_at")
	private Instant claimExpiresAt;

	@Column(name = "last_failure_code", length = 50)
	private String lastFailureCode;

	@Column(name = "last_failed_at")
	private Instant lastFailedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected CallReportGenerationRequest() {
	}

	public CallReportGenerationRequest(Long callSessionId, long inputRevision) {
		this.callSessionId = callSessionId;
		this.inputRevision = inputRevision;
		this.status = CallReportGenerationStatus.PENDING;
	}

	public Long getCallSessionId() {
		return callSessionId;
	}

	public CallReportGenerationStatus getStatus() {
		return status;
	}

	public long getInputRevision() {
		return inputRevision;
	}

	public UUID getClaimToken() {
		return claimToken;
	}

	public Instant getClaimExpiresAt() {
		return claimExpiresAt;
	}

	public String getLastFailureCode() {
		return lastFailureCode;
	}

	public boolean isClaimable(Instant now) {
		return status == CallReportGenerationStatus.PENDING
			|| (status == CallReportGenerationStatus.CLAIMED
				&& claimExpiresAt != null
				&& !claimExpiresAt.isAfter(now));
	}

	public void claim(UUID token, long revision, Instant expiresAt) {
		status = CallReportGenerationStatus.CLAIMED;
		inputRevision = revision;
		claimToken = token;
		claimExpiresAt = expiresAt;
		lastFailureCode = null;
		lastFailedAt = null;
	}

	public boolean ownsClaim(UUID token, long revision, Instant now) {
		return status == CallReportGenerationStatus.CLAIMED
			&& token != null
			&& token.equals(claimToken)
			&& inputRevision == revision
			&& claimExpiresAt != null
			&& claimExpiresAt.isAfter(now);
	}

	public void markGeminiFailed(String code, Instant failedAt) {
		status = CallReportGenerationStatus.GEMINI_FAILED;
		lastFailureCode = code;
		lastFailedAt = failedAt;
		clearClaim();
	}

	public void markDone() {
		status = CallReportGenerationStatus.DONE;
		clearClaim();
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	private void clearClaim() {
		claimToken = null;
		claimExpiresAt = null;
	}
}
