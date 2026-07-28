package com.ssafy.s15p11b104.global.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 인증 토큰 발급 기준을 담는다.
 *
 * @param secret               Access Token 서명 키. HS256 요구사항에 따라 32바이트 이상이어야 한다.
 * @param accessTokenValidity  Access Token 유효 기간
 * @param refreshTokenValidity Refresh Token 유효 기간이며 Redis 키의 만료 시간으로도 사용한다.
 */
@Validated
@ConfigurationProperties(prefix = "app.auth")
public record AuthTokenProperties(
	@NotBlank @Size(min = 32) String secret,
	@NotNull Duration accessTokenValidity,
	@NotNull Duration refreshTokenValidity
) {
}
