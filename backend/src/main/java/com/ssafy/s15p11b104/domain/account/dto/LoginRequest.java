package com.ssafy.s15p11b104.domain.account.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그인 요청이다.
 *
 * @param loginId  로그인 ID
 * @param password 원문 비밀번호
 */
public record LoginRequest(@NotBlank String loginId, @NotBlank String password) {
}
