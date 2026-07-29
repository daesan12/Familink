package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;

public record JoinRequestCreateResponse(
	Long joinRequestId,
	Long groupId,
	String groupName,
	JoinRequestStatus status) {
}
