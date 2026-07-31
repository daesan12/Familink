package com.ssafy.s15p11b104.domain.report.dto;

import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

/**
 * 일일 리포트 본문이다.
 *
 * <p>{@code guardianMessageSummary}는 저장된 {@code daily_reports.guardian_message}의 노출명이며
 * 전달할 내용이 없으면 {@code null}이다. 감정 소분류는 허용 목록이 확정되지 않았으므로 저장된
 * 문자열을 그대로 전달한다.
 */
public record DailyReportSummaryResponse(
	Long id,
	String summary,
	EmotionCategory emotionCategory,
	String emotionSubcategory,
	String guardianMessageSummary) {
}
