package com.ssafy.s15p11b104.global.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * 사용자 인증에 사용하는 Access Token을 발급한다.
 *
 * <p>Access Token은 서버에 저장하지 않는 자체 검증 토큰이며 사용자 ID를 subject로 담는다.
 */
@Component
public class AccessTokenProvider {

	private final SecretKey signingKey;
	private final Duration validity;

	AccessTokenProvider(AuthTokenProperties properties) {
		this.signingKey = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
		this.validity = properties.accessTokenValidity();
	}

	/**
	 * 지정한 사용자를 subject로 하는 Access Token을 발급한다.
	 *
	 * @param userId 토큰 소유자의 사용자 ID
	 * @return 서명된 Access Token 문자열
	 */
	public String issue(Long userId) {
		Instant issuedAt = Instant.now();
		return Jwts.builder()
			.subject(String.valueOf(userId))
			.issuedAt(Date.from(issuedAt))
			.expiration(Date.from(issuedAt.plus(validity)))
			.signWith(signingKey)
			.compact();
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
