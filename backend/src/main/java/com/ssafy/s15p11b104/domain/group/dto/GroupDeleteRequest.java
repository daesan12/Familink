package com.ssafy.s15p11b104.domain.group.dto;

import jakarta.validation.constraints.NotNull;

public record GroupDeleteRequest(
	@NotNull(message = "확인용 그룹 이름은 필수입니다.")
	String confirmationName) {
}
