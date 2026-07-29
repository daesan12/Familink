package com.ssafy.s15p11b104.domain.carnation.dto;

import java.time.LocalDate;
import java.util.List;

public record CarnationCalendarResponse(
	Long memberId,
	LocalDate startDate,
	LocalDate endDate,
	List<LocalDate> earnedDates) {
}
