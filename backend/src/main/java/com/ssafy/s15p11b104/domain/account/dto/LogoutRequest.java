package com.ssafy.s15p11b104.domain.account.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그아웃 요청이다.
 *
 * @param refreshToken 폐기할 Refresh Token
 */
public record LogoutRequest(@NotBlank String refreshToken) {
}
