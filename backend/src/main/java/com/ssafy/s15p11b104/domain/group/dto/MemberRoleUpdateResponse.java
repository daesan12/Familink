package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

public record MemberRoleUpdateResponse(
	Long groupId,
	Long memberId,
	GroupRole role) {
}
