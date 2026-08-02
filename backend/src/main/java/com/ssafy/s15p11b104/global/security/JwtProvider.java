package com.ssafy.s15p11b104.global.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * 인증 토큰으로 사용하는 JWT를 발급하고 검증한다.
 *
 * <p>토큰 용도를 {@code use} 클레임으로 구분해 Refresh Token을 Access Token 자리에 사용할 수 없게 한다.
 * 같은 사용자에게 같은 초에 발급된 토큰이 동일한 문자열이 되지 않도록 매 발급마다 고유 ID를 넣는다.
 */
@Component
public class JwtProvider {

	private static final String TOKEN_USE_CLAIM = "use";

	private final SecretKey signingKey;

	JwtProvider(AuthTokenProperties properties) {
		this.signingKey = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
	}

	/**
	 * 지정한 사용자와 용도로 서명된 토큰을 발급한다.
	 *
	 * @param userId   토큰 소유자의 사용자 ID
	 * @param validity 유효 기간
	 * @param tokenUse 토큰 용도
	 * @return 서명된 토큰 문자열
	 */
	String issue(Long userId, Duration validity, String tokenUse) {
		Instant issuedAt = Instant.now();
		return Jwts.builder()
			.subject(String.valueOf(userId))
			.claim(TOKEN_USE_CLAIM, tokenUse)
			.id(UUID.randomUUID().toString())
			.issuedAt(Date.from(issuedAt))
			.expiration(Date.from(issuedAt.plus(validity)))
			.signWith(signingKey)
			.compact();
	}

	/**
	 * 서명, 만료, 용도를 검증하고 토큰 내용을 반환한다.
	 *
	 * @param token            검증할 토큰
	 * @param expectedTokenUse 기대하는 토큰 용도
	 * @return 검증에 성공하면 토큰 내용, 실패하면 빈 값
	 */
	Optional<JwtPayload> verify(String token, String expectedTokenUse) {
		try {
			Claims claims = Jwts.parser()
				.verifyWith(signingKey)
				.build()
				.parseSignedClaims(token)
				.getPayload();

			if (!expectedTokenUse.equals(claims.get(TOKEN_USE_CLAIM, String.class))) {
				return Optional.empty();
			}

			Long userId = Long.valueOf(claims.getSubject());
			return Optional.of(new JwtPayload(userId, claims.getExpiration().toInstant()));
		} catch (JwtException | IllegalArgumentException exception) {
			return Optional.empty();
		}
	}

	/**
	 * 검증된 토큰의 내용이다.
	 *
	 * @param userId    토큰 소유자의 사용자 ID
	 * @param expiresAt 토큰 만료 시각
	 */
	public record JwtPayload(Long userId, Instant expiresAt) {
	}
}
