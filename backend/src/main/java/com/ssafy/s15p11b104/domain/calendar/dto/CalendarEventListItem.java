package com.ssafy.s15p11b104.domain.calendar.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 일정 목록의 항목이다.
 *
 * <p>{@code eventDate}는 시작 날짜, {@code endDate}는 종료 날짜다. 날짜 일정은
 * {@code startAt}·{@code endAt}이 모두 null이다.
 */
public record CalendarEventListItem(
	Long id,
	String title,
	LocalDate eventDate,
	LocalDate endDate,
	Instant startAt,
	Instant endAt) {
}
