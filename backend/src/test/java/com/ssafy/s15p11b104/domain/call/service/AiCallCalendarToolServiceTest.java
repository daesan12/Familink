package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class AiCallCalendarToolServiceTest {

	private static final LocalDate TODAY = LocalDate.of(2026, 8, 2);

	@Test
	void resolvesRelativeAndExplicitKoreanDates() {
		assertThat(AiCallCalendarToolService.resolveDate("오늘", TODAY)).isEqualTo(TODAY);
		assertThat(AiCallCalendarToolService.resolveDate("내일", TODAY)).isEqualTo(TODAY.plusDays(1));
		assertThat(AiCallCalendarToolService.resolveDate("2026-08-03", TODAY))
			.isEqualTo(LocalDate.of(2026, 8, 3));
		assertThat(AiCallCalendarToolService.resolveDate("2026년 8월 3일", TODAY))
			.isEqualTo(LocalDate.of(2026, 8, 3));
	}

	@Test
	void resolvesExplicitWeekdayRelativeToKoreanWeek() {
		assertThat(AiCallCalendarToolService.resolveDate("이번 주 월요일", TODAY))
			.isEqualTo(LocalDate.of(2026, 7, 27));
		assertThat(AiCallCalendarToolService.resolveDate("다음 주 월요일", TODAY))
			.isEqualTo(LocalDate.of(2026, 8, 3));
	}

	@Test
	void rejectsAmbiguousOrInvalidExpressions() {
		assertThat(AiCallCalendarToolService.resolveDate("8월 3일", TODAY)).isNull();
		assertThat(AiCallCalendarToolService.resolveDate("2026-02-30", TODAY)).isNull();
		assertThat(AiCallCalendarToolService.resolveDate("이번 주말", TODAY)).isNull();
	}
}
