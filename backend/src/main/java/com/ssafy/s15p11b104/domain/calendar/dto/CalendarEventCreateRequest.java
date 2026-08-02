package com.ssafy.s15p11b104.domain.calendar.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 일정 등록 요청이다.
 *
 * <p>시간 일정은 {@code startAt}·{@code endAt}을 보내고 날짜 쌍은 서버가 {@code Asia/Seoul} 기준으로
 * 파생하므로 요청의 날짜 값을 무시한다. 날짜 일정은 시각을 보내지 않고 {@code eventDate}를 보내며
 * {@code endDate}를 생략하면 하루짜리 일정이 된다.
 *
 * <p>날짜와 시각의 조합 규칙은 필드 단위 제약으로 표현할 수 없어 {@code CalendarEventService}가 검증한다.
 */
public record CalendarEventCreateRequest(
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
