package com.ssafy.s15p11b104.domain.account.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 토큰 재발급 요청이다.
 *
 * @param refreshToken 재발급에 사용할 Refresh Token
 */
public record ReissueRequest(@NotBlank String refreshToken) {
}
