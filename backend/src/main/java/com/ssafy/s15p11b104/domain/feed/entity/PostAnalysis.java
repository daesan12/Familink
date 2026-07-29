package com.ssafy.s15p11b104.domain.feed.entity;

import java.time.Instant;

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

	public void resetToPending() {
		status = AnalysisStatus.PENDING;
		summary = null;
		analyzedAt = null;
	}

	public void complete(String summary, Instant analyzedAt) {
		this.status = AnalysisStatus.SUCCESS;
		this.summary = summary;
		this.analyzedAt = analyzedAt;
	}

	public void fail() {
		status = AnalysisStatus.FAILED;
		summary = null;
		analyzedAt = null;
	}
}
