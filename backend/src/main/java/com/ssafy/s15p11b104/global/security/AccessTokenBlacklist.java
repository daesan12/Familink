package com.ssafy.s15p11b104.global.security;

import java.time.Duration;
import java.time.Instant;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 차단된 Access Token을 Redis에 등록해 만료 전까지 통과하지 못하게 한다.
 *
 * <p>Access Token은 자체 검증 토큰이라 발급 후 만료 전까지 유효하다. 탈취된 토큰이 계속 통과하는
 * 것을 막기 위해 차단 대상을 Redis에 남긴다.
 *
 * <p>차단 단위는 두 가지다. 로그아웃은 그 요청에 실린 토큰 하나만 끊으면 되므로 토큰 단위 키를
 * 쓰고, 탈퇴는 재발급으로 이미 받아 둔 토큰까지 모두 끊어야 하므로 사용자 단위 키를 쓴다.
 */
@Component
public class AccessTokenBlacklist {

	private static final String KEY_PREFIX = "blacklist:";
	private static final String USER_KEY_PREFIX = "blacklist:user:";
	private static final String BLACKLISTED_VALUE = "logout";
	private static final String WITHDRAWN_VALUE = "withdrawn";

	private final StringRedisTemplate redisTemplate;
	private final Duration accessTokenValidity;

	AccessTokenBlacklist(StringRedisTemplate redisTemplate, AuthTokenProperties properties) {
		this.redisTemplate = redisTemplate;
		this.accessTokenValidity = properties.accessTokenValidity();
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

	/**
	 * 사용자에게 이미 발급된 모든 Access Token을 차단한다.
	 *
	 * <p>차단 기간은 Access Token 유효 기간 전체다. 이 시점 이전에 발급된 토큰의 남은 수명은 항상 이
	 * 기간보다 짧으므로, 등록 시점에 살아 있던 토큰은 모두 만료 전까지 막힌다.
	 *
	 * @param userId 차단할 사용자 ID
	 */
	public void registerUser(Long userId) {
		redisTemplate.opsForValue().set(toUserKey(userId), WITHDRAWN_VALUE, accessTokenValidity);
	}

	/**
	 * 사용자가 차단되어 있는지 확인한다.
	 *
	 * @param userId 확인할 사용자 ID
	 * @return 차단되어 있으면 {@code true}
	 */
	public boolean containsUser(Long userId) {
		return Boolean.TRUE.equals(redisTemplate.hasKey(toUserKey(userId)));
	}

	/**
	 * 사용자 단위 차단을 해제한다.
	 *
	 * <p>차단을 등록한 작업이 실패해 계정이 활성으로 남는 경우에 사용한다. 차단이 남으면 그 사용자는
	 * 다시 로그인해도 TTL이 끝날 때까지 모든 인증 요청이 거부된다.
	 *
	 * @param userId 차단을 해제할 사용자 ID
	 */
	public void removeUser(Long userId) {
		redisTemplate.delete(toUserKey(userId));
	}

	private String toKey(String accessToken) {
		return KEY_PREFIX + accessToken;
	}

	private String toUserKey(Long userId) {
		return USER_KEY_PREFIX + userId;
	}
}
