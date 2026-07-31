package com.ssafy.s15p11b104.domain.calendar.dto;

import java.util.List;

public record CalendarEventListResponse(List<CalendarEventListItem> events) {
}
