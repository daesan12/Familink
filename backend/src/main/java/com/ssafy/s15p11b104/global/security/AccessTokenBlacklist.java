package com.ssafy.s15p11b104.global.security;

import java.time.Duration;
import java.time.Instant;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 로그아웃된 Access Token을 Redis에 등록해 만료 전까지 차단한다.
 *
 * <p>Access Token은 자체 검증 토큰이라 발급 후 만료 전까지 유효하다. 로그아웃 후 탈취된 토큰이
 * 계속 통과하는 것을 막기 위해 남은 만료 시간만큼만 블랙리스트에 남긴다.
 */
@Component
public class AccessTokenBlacklist {

	private static final String KEY_PREFIX = "blacklist:";
	private static final String BLACKLISTED_VALUE = "logout";

	private final StringRedisTemplate redisTemplate;

	AccessTokenBlacklist(StringRedisTemplate redisTemplate) {
		this.redisTemplate = redisTemplate;
	}

	/**
	 * Access Token을 남은 만료 시간만큼 블랙리스트에 등록한다.
	 *
	 * @param accessToken 차단할 Access Token
	 * @param expiresAt   해당 토큰의 만료 시각
	 */
	public void register(String accessToken, Instant expiresAt) {
		Duration remaining = Duration.between(Instant.now(), expiresAt);
		if (remaining.isNegative() || remaining.isZero()) {
			return;
		}
		redisTemplate.opsForValue().set(toKey(accessToken), BLACKLISTED_VALUE, remaining);
	}

	/**
	 * Access Token이 블랙리스트에 등록되어 있는지 확인한다.
	 *
	 * @param accessToken 확인할 Access Token
	 * @return 등록되어 있으면 {@code true}
	 */
	public boolean contains(String accessToken) {
		return Boolean.TRUE.equals(redisTemplate.hasKey(toKey(accessToken)));
	}

	private String toKey(String accessToken) {
		return KEY_PREFIX + accessToken;
	}
}
