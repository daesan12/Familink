package com.ssafy.s15p11b104.domain.call.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
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
@Table(name = "call_reports")
public class CallReport extends CreatedAtEntity {

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "call_session_id", nullable = false, unique = true)
	private CallSession callSession;

	@Column(nullable = false, length = 100)
	private String summary;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "emotion_category", nullable = false, columnDefinition = "emotion_category")
	private EmotionCategory emotionCategory;

	@Column(name = "emotion_subcategory", nullable = false, length = 50)
	private String emotionSubcategory;

	@Column(name = "guardian_message", length = 100)
	private String guardianMessage;

	protected CallReport() {
	}

	public CallReport(CallSession callSession, String summary, EmotionCategory emotionCategory,
		String emotionSubcategory) {
		this.callSession = callSession;
		this.summary = summary;
		this.emotionCategory = emotionCategory;
		this.emotionSubcategory = emotionSubcategory;
	}

	public CallSession getCallSession() {
		return callSession;
	}

	public String getSummary() {
		return summary;
	}

	public EmotionCategory getEmotionCategory() {
		return emotionCategory;
	}

	public String getEmotionSubcategory() {
		return emotionSubcategory;
	}

	public String getGuardianMessage() {
		return guardianMessage;
	}
}
