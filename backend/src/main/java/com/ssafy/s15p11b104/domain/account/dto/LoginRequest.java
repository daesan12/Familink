package com.ssafy.s15p11b104.domain.account.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 로그인 요청이다.
 *
 * <p>형식을 벗어난 입력은 인증 실패가 아니라 요청 검증 실패로 처리한다.
 *
 * @param loginId  로그인 ID
 * @param password 원문 비밀번호
 */
public record LoginRequest(
	@NotBlank @Size(min = 5, max = 15) String loginId,
	@NotBlank @Size(min = 8, max = 16) String password
) {
}
