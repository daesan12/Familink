package com.ssafy.s15p11b104.domain.account.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 로그인 요청이다.
 *
 * <p>기존 계정 호환을 위해 회원가입 형식 조건은 적용하지 않고, 입력값을 그대로 인증에 사용한다.
 *
 * @param loginId  로그인 ID
 * @param password 원문 비밀번호
 */
public record LoginRequest(
	@NotBlank @Size(max = 15) String loginId,
	@NotBlank @Size(max = 16) String password
) {
}
