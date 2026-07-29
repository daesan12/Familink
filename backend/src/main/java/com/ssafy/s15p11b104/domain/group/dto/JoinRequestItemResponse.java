package com.ssafy.s15p11b104.domain.group.dto;

import java.time.Instant;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;

public record JoinRequestItemResponse(
	Long joinRequestId,
	Long applicantUserId,
	String applicantName,
	String profileImageUrl,
	JoinRequestStatus status,
	GroupRole assignedRole,
	Instant processedAt,
	Instant createdAt) {
}
