package com.ssafy.s15p11b104.global.security;

/**
 * 인증된 요청의 주체다.
 *
 * <p>{@code Authentication}의 주체는 Spring Security 디버그 로그와 예외 메시지에 그대로 출력되므로
 * Access Token 원문이 새지 않도록 {@link #toString()}에서 제외한다.
 *
 * @param id          인증된 사용자 ID
 * @param accessToken 인증에 사용된 Access Token이며 로그아웃 시 블랙리스트 등록에 사용한다.
 */
public record AuthenticatedUser(Long id, String accessToken) {

	@Override
	public String toString() {
		return "AuthenticatedUser[id=" + id + "]";
	}
}
