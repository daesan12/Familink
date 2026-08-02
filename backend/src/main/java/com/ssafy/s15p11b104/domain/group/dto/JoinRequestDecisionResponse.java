package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;

public record JoinRequestDecisionResponse(
	Long joinRequestId,
	JoinRequestStatus status,
	Long memberId,
	GroupRole assignedRole) {
}
