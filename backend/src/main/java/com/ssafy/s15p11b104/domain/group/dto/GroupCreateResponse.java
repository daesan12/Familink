package com.ssafy.s15p11b104.domain.group.dto;

import java.time.Instant;

public record GroupCreateResponse(
	Long groupId,
	Long managerMemberId,
	String inviteCode,
	Instant createdAt) {
}
