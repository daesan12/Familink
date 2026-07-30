package com.ssafy.s15p11b104.domain.report.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

public record DailyReportWindow(Instant startInclusive, Instant endExclusive) {

	public static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Seoul");

	public static DailyReportWindow forReportDate(LocalDate reportDate) {
		Objects.requireNonNull(reportDate, "reportDate must not be null");
		Instant startInclusive = reportDate.minusDays(1)
			.atTime(22, 0)
			.atZone(REPORT_ZONE)
			.toInstant();
		Instant endExclusive = reportDate
			.atTime(22, 0)
			.atZone(REPORT_ZONE)
			.toInstant();
		return new DailyReportWindow(startInclusive, endExclusive);
	}
}
