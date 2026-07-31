package com.ssafy.s15p11b104.domain.calendar.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 일정 수정 요청이다.
 *
 * <p>{@code API-CALENDAR-004}는 전체 갱신이므로 보내지 않은 필드는 비우는 것으로 처리한다.
 * 날짜와 시각의 해석 규칙은 {@link CalendarEventCreateRequest}와 같다.
 */
public record CalendarEventUpdateRequest(
	@NotBlank(message = "제목은 필수입니다.")
	@Size(max = 20, message = "제목은 20자를 넘을 수 없습니다.")
	String title,

	@Size(max = 50, message = "설명은 50자를 넘을 수 없습니다.")
	String description,

	LocalDate eventDate,
	LocalDate endDate,
	Instant startAt,
	Instant endAt,
	List<Long> participantMemberIds) {
}
