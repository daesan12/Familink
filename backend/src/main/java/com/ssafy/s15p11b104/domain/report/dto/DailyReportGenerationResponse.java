package com.ssafy.s15p11b104.domain.report.dto;

import java.time.LocalDate;

public record DailyReportGenerationResponse(
	LocalDate reportDate,
	DailyReportGenerationStatus generationStatus) {
}
