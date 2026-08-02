package com.ssafy.s15p11b104.domain.group.dto;

import jakarta.validation.constraints.NotNull;

public record AliasUpdateRequest(
	@NotNull(message = "호칭은 필수입니다.")
	String alias) {
}
