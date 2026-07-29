package com.ssafy.s15p11b104.domain.account.dto;

/**
 * 토큰 재발급 결과다.
 *
 * <p>재발급은 회전 방식이므로 Access Token과 Refresh Token을 모두 새로 발급하고 기존 Refresh
 * Token은 폐기된다.
 *
 * @param tokenType            Access Token을 전달할 인증 스킴
 * @param accessToken          새로 발급된 Access Token
 * @param accessTokenExpiresIn Access Token 유효 기간의 초 값
 * @param refreshToken         새로 발급된 Refresh Token
 */
public record ReissueResponse(
	String tokenType,
	String accessToken,
	long accessTokenExpiresIn,
	String refreshToken
) {
}
