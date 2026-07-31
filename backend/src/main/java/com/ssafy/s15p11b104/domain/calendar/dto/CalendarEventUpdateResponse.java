package com.ssafy.s15p11b104.domain.calendar.dto;

import java.time.Instant;

public record CalendarEventUpdateResponse(Long id, Long lastEditorMemberId, Instant updatedAt) {
}
