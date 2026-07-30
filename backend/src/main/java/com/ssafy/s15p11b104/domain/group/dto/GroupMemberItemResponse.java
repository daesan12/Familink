package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

public record GroupMemberItemResponse(
	Long memberId,
	Long userId,
	String displayName,
	GroupRole role,
	boolean isManager) {
}
