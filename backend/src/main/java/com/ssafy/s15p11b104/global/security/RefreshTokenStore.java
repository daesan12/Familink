package com.ssafy.s15p11b104.global.security;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Refresh Token을 Redis에 저장하고 폐기한다.
 *
 * <p>토큰 자체를 키로 사용하고 소유자의 사용자 ID를 값으로 저장한다. 키의 만료 시간을 토큰
 * 유효 기간과 동일하게 설정해 만료된 토큰이 자동으로 제거되게 한다.
 */
@Component
public class RefreshTokenStore {

	private static final String KEY_PREFIX = "auth:refresh:";
	private static final int TOKEN_BYTE_LENGTH = 32;

	private final StringRedisTemplate redisTemplate;
	private final Duration validity;
	private final SecureRandom secureRandom = new SecureRandom();
	private final Base64.Encoder tokenEncoder = Base64.getUrlEncoder().withoutPadding();

	RefreshTokenStore(StringRedisTemplate redisTemplate, AuthTokenProperties properties) {
		this.redisTemplate = redisTemplate;
		this.validity = properties.refreshTokenValidity();
	}

	/**
	 * 새 Refresh Token을 만들어 소유자와 함께 저장한다.
	 *
	 * @param userId 토큰 소유자의 사용자 ID
	 * @return 저장된 Refresh Token 문자열
	 */
	public String issue(Long userId) {
		String refreshToken = generateToken();
		redisTemplate.opsForValue().set(toKey(refreshToken), String.valueOf(userId), validity);
		return refreshToken;
	}

	/**
	 * Refresh Token을 폐기해 더 이상 사용할 수 없게 한다.
	 *
	 * @param refreshToken 폐기할 Refresh Token
	 * @return 저장되어 있던 토큰을 폐기하면 {@code true}, 이미 없으면 {@code false}
	 */
	public boolean revoke(String refreshToken) {
		return Boolean.TRUE.equals(redisTemplate.delete(toKey(refreshToken)));
	}

	private String generateToken() {
		byte[] tokenBytes = new byte[TOKEN_BYTE_LENGTH];
		secureRandom.nextBytes(tokenBytes);
		return tokenEncoder.encodeToString(tokenBytes);
	}

	private String toKey(String refreshToken) {
		return KEY_PREFIX + refreshToken;
	}
}
