package com.ssafy.s15p11b104.domain.call.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

public record AiCallDevReportResponse(
	@JsonProperty("call_session_id")
	Long callSessionId,

	@JsonProperty("report_status")
	ReportStatus reportStatus,

	String summary,

	@JsonProperty("emotion_category")
	EmotionCategory emotionCategory,

	@JsonProperty("emotion_subcategory")
	String emotionSubcategory,

	@JsonProperty("guardian_message")
	String guardianMessage,

	@JsonProperty("created_at")
	@JsonFormat(shape = JsonFormat.Shape.STRING)
	Instant createdAt
) {

	public static AiCallDevReportResponse ready(CallReport report) {
		return new AiCallDevReportResponse(
			report.getCallSession().getId(),
			ReportStatus.READY,
			report.getSummary(),
			report.getEmotionCategory(),
			report.getEmotionSubcategory(),
			report.getGuardianMessage(),
			report.getCreatedAt()
		);
	}

	public static AiCallDevReportResponse pending(Long callSessionId) {
		return new AiCallDevReportResponse(
			callSessionId,
			ReportStatus.PENDING,
			null,
			null,
			null,
			null,
			null
		);
	}

	public static AiCallDevReportResponse notApplicable(Long callSessionId) {
		return new AiCallDevReportResponse(
			callSessionId,
			ReportStatus.NOT_APPLICABLE,
			null,
			null,
			null,
			null,
			null
		);
	}

	public enum ReportStatus {
		PENDING,
		READY,
		NOT_APPLICABLE
	}
}
