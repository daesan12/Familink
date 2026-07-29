package com.ssafy.s15p11b104.domain.group.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record GroupCreateRequest(
	@NotBlank(message = "그룹 이름은 필수입니다.")
	@Size(max = 10, message = "그룹 이름은 10자 이하여야 합니다.")
	String name,

	@NotNull(message = "본인의 그룹 역할은 필수입니다.")
	GroupRole myRole) {
}
