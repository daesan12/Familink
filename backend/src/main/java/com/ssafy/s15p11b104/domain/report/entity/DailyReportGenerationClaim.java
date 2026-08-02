package com.ssafy.s15p11b104.domain.report.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "daily_report_generation_claims")
public class DailyReportGenerationClaim extends CreatedAtEntity {

	@Column(name = "care_receiver_member_id", nullable = false)
	private Long careReceiverMemberId;

	@Column(name = "report_date", nullable = false)
	private LocalDate reportDate;

	@JdbcTypeCode(SqlTypes.UUID)
	@Column(name = "claim_token", nullable = false, columnDefinition = "uuid")
	private UUID claimToken;

	@Column(name = "claim_expires_at", nullable = false)
	private Instant claimExpiresAt;

	@Column(name = "input_report_count", nullable = false)
	private int inputReportCount;

	@Column(name = "input_latest_report_id", nullable = false)
	private long inputLatestReportId;

	protected DailyReportGenerationClaim() {
	}

	public DailyReportGenerationClaim(
		Long careReceiverMemberId,
		LocalDate reportDate,
		UUID claimToken,
		Instant claimExpiresAt,
		int inputReportCount,
		long inputLatestReportId
	) {
		this.careReceiverMemberId = careReceiverMemberId;
		this.reportDate = reportDate;
		renew(claimToken, claimExpiresAt, inputReportCount, inputLatestReportId);
	}

	public UUID getClaimToken() {
		return claimToken;
	}

	public Instant getClaimExpiresAt() {
		return claimExpiresAt;
	}

	public int getInputReportCount() {
		return inputReportCount;
	}

	public long getInputLatestReportId() {
		return inputLatestReportId;
	}

	public boolean isAvailableTo(UUID token, Instant now) {
		return claimToken.equals(token) || !claimExpiresAt.isAfter(now);
	}

	public boolean owns(UUID token, int expectedCount, long expectedLatestReportId, Instant now) {
		return claimToken.equals(token)
			&& claimExpiresAt.isAfter(now)
			&& inputReportCount == expectedCount
			&& inputLatestReportId == expectedLatestReportId;
	}

	public void renew(
		UUID token,
		Instant expiresAt,
		int inputCount,
		long latestReportId
	) {
		claimToken = token;
		claimExpiresAt = expiresAt;
		inputReportCount = inputCount;
		inputLatestReportId = latestReportId;
	}
}
