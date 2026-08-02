package com.ssafy.s15p11b104.domain.group.dto;

import java.time.Instant;

import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;

public record JoinRequestSummaryResponse(
	Long joinRequestId,
	Long groupId,
	String groupName,
	JoinRequestStatus status,
	Instant requestedAt,
	Instant processedAt) {
}
