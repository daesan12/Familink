package com.ssafy.s15p11b104.domain.report.service;

import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

public record DailyReportAnalysis(
	String summary,
	EmotionCategory emotionCategory,
	String emotionSubcategory,
	String guardianMessage
) {
}
