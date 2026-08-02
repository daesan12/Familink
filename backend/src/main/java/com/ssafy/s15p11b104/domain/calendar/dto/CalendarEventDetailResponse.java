package com.ssafy.s15p11b104.domain.calendar.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * 일정 상세 응답이다.
 *
 * <p>{@code eventDate}는 시작 날짜, {@code endDate}는 종료 날짜이며 하루짜리 일정은 두 값이 같다.
 */
public record CalendarEventDetailResponse(
	Long id,
	Long groupId,
	String title,
	String description,
	LocalDate eventDate,
	LocalDate endDate,
	Instant startAt,
	Instant endAt,
	Long creatorMemberId,
	List<Long> participantMemberIds) {
}
