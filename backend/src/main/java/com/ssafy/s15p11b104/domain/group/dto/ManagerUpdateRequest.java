package com.ssafy.s15p11b104.domain.group.dto;

import jakarta.validation.constraints.NotNull;

public record ManagerUpdateRequest(
	@NotNull(message = "새 관리자의 구성원 ID는 필수입니다.")
	Long newManagerMemberId) {
}
