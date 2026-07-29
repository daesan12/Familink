package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

public record GroupSummaryResponse(
	Long id,
	String name,
	Long myMemberId,
	GroupRole myRole,
	long memberCount,
	boolean isManager) {
}
