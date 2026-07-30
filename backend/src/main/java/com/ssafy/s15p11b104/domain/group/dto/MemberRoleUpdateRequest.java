package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

import jakarta.validation.constraints.NotNull;

public record MemberRoleUpdateRequest(
	@NotNull(message = "역할은 필수입니다.")
	GroupRole role) {
}
