package com.ssafy.s15p11b104.domain.group.dto;

import java.time.Instant;

public record GroupUpdateResponse(
	Long id,
	String name,
	Instant updatedAt) {
}
