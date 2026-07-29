package com.ssafy.s15p11b104.domain.account.dto;

/**
 * 로그인 결과로 발급된 인증 정보다.
 *
 * @param tokenType             Access Token을 전달할 인증 스킴
 * @param accessToken           발급된 Access Token
 * @param accessTokenExpiresIn  Access Token 유효 기간의 초 값
 * @param refreshToken          발급된 Refresh Token
 * @param user                  로그인한 사용자 요약 정보
 */
public record LoginResponse(
	String tokenType,
	String accessToken,
	long accessTokenExpiresIn,
	String refreshToken,
	LoginUser user
) {

	/**
	 * 로그인 응답에 포함하는 사용자 요약 정보다.
	 *
	 * @param id   사용자 ID
	 * @param name 사용자 이름
	 */
	public record LoginUser(Long id, String name) {
	}
}
