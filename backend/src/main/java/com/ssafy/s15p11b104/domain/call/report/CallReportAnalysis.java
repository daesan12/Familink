package com.ssafy.s15p11b104.domain.call.report;

import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

public record CallReportAnalysis(
	String summary,
	EmotionCategory emotionCategory,
	String emotionSubcategory,
	String guardianMessage
) {
}
