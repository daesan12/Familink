package com.ssafy.s15p11b104.global.security;

import java.time.Duration;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.global.security.JwtProvider.JwtPayload;

/**
 * 사용자 인증에 사용하는 Access Token을 발급하고 검증한다.
 *
 * <p>Access Token은 서버에 저장하지 않는 자체 검증 토큰이며, 로그아웃된 토큰은
 * {@link AccessTokenBlacklist}에서 따로 차단한다.
 */
@Component
public class AccessTokenProvider {

	private static final String TOKEN_USE = "access";

	private final JwtProvider jwtProvider;
	private final Duration validity;

	AccessTokenProvider(JwtProvider jwtProvider, AuthTokenProperties properties) {
		this.jwtProvider = jwtProvider;
		this.validity = properties.accessTokenValidity();
	}

	/**
	 * 지정한 사용자의 Access Token을 발급한다.
	 *
	 * @param userId 토큰 소유자의 사용자 ID
	 * @return 서명된 Access Token 문자열
	 */
	public String issue(Long userId) {
		return jwtProvider.issue(userId, validity, TOKEN_USE);
	}

	/**
	 * Access Token의 서명, 만료, 용도를 검증한다.
	 *
	 * @param accessToken 검증할 Access Token
	 * @return 검증에 성공하면 토큰 내용, 실패하면 빈 값
	 */
	public Optional<JwtPayload> verify(String accessToken) {
		return jwtProvider.verify(accessToken, TOKEN_USE);
	}

	/**
	 * 발급되는 Access Token의 유효 기간을 초 단위로 반환한다.
	 *
	 * @return Access Token 유효 기간의 초 값
	 */
	public long getValidityInSeconds() {
		return validity.toSeconds();
	}
}
