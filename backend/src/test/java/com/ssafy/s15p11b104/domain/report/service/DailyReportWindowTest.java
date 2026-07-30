package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class DailyReportWindowTest {

	@Test
	void convertsKoreanStandardTimeWindowToUtc() {
		DailyReportWindow window = DailyReportWindow.forReportDate(LocalDate.of(2026, 7, 30));

		assertThat(window.startInclusive()).isEqualTo(Instant.parse("2026-07-29T13:00:00Z"));
		assertThat(window.endExclusive()).isEqualTo(Instant.parse("2026-07-30T13:00:00Z"));
	}

	@Test
	void includesStartAndExcludesEndByContract() {
		DailyReportWindow window = DailyReportWindow.forReportDate(LocalDate.of(2026, 7, 30));

		assertThat(window.startInclusive()).isBefore(window.endExclusive());
		assertThat(window.startInclusive()).isEqualTo(Instant.parse("2026-07-29T13:00:00Z"));
		assertThat(window.endExclusive()).isEqualTo(Instant.parse("2026-07-30T13:00:00Z"));
	}
}
