package com.ssafy.s15p11b104.global.security;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.global.security.JwtProvider.JwtPayload;

/**
 * Refresh Token을 발급하고 Redis에서 관리한다.
 *
 * <p>키는 {@code refresh:{userId}}이므로 사용자당 활성 Refresh Token은 하나다. 교체와 폐기는
 * 제시된 토큰이 현재 저장된 토큰일 때만 수행하며, 검사와 쓰기를 하나의 Lua 스크립트로 처리해
 * 동시에 들어온 요청이 서로의 결과를 덮어쓰지 못하게 한다.
 */
@Component
public class RefreshTokenStore {

	private static final String TOKEN_USE = "refresh";
	private static final String KEY_PREFIX = "refresh:";

	/** 저장값이 제시된 토큰과 같을 때만 새 토큰으로 교체한다. */
	private static final RedisScript<Long> ROTATE_SCRIPT = RedisScript.of("""
		if redis.call('GET', KEYS[1]) == ARGV[1] then
			redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
			return 1
		end
		return 0
		""", Long.class);

	/** 저장값이 제시된 토큰과 같을 때만 삭제한다. */
	private static final RedisScript<Long> REVOKE_SCRIPT = RedisScript.of("""
		if redis.call('GET', KEYS[1]) == ARGV[1] then
			return redis.call('DEL', KEYS[1])
		end
		return 0
		""", Long.class);

	private static final RedisScript<Long> ISSUE_IF_ABSENT_SCRIPT = RedisScript.of("""
		if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 end
		return 0
		""", Long.class);

	private final JwtProvider jwtProvider;
	private final StringRedisTemplate redisTemplate;
	private final Duration validity;

	RefreshTokenStore(JwtProvider jwtProvider, StringRedisTemplate redisTemplate, AuthTokenProperties properties) {
		this.jwtProvider = jwtProvider;
		this.redisTemplate = redisTemplate;
		this.validity = properties.refreshTokenValidity();
	}

	/**
	 * 새 Refresh Token을 발급해 저장한다. 같은 사용자의 기존 토큰은 덮어씌워져 폐기된다.
	 *
	 * <p>로그인은 기존 세션 상태와 무관하게 새 세션을 시작하므로 조건 없이 저장한다.
	 *
	 * @param userId 토큰 소유자의 사용자 ID
	 * @return 발급된 Refresh Token 문자열
	 */
	public Optional<String> issueIfAbsent(Long userId) {
		String refreshToken = jwtProvider.issue(userId, validity, TOKEN_USE);
		Long applied = redisTemplate.execute(
			ISSUE_IF_ABSENT_SCRIPT,
			List.of(toKey(userId)),
			refreshToken,
			String.valueOf(validity.toMillis()));
		return isApplied(applied) ? Optional.of(refreshToken) : Optional.empty();
	}

	/** 테스트와 내부 호출에서 세션이 없을 때만 토큰을 발급한다. */
	public String issue(Long userId) {
		return issueIfAbsent(userId).orElseThrow(() -> new IllegalStateException("active refresh token exists"));
	}

	/**
	 * 제시된 토큰이 현재 저장된 토큰일 때만 새 토큰으로 교체한다.
	 *
	 * <p>이미 회전되었거나 폐기된 토큰으로는 교체할 수 없으므로, 재발급의 "기존 토큰 즉시 폐기"와
	 * "폐기된 토큰 재사용 거부"가 함께 보장된다.
	 *
	 * @param userId       토큰 소유자의 사용자 ID
	 * @param refreshToken 교체 대상으로 제시된 Refresh Token
	 * @return 교체에 성공하면 새로 발급된 Refresh Token, 실패하면 빈 값
	 */
	public Optional<String> rotate(Long userId, String refreshToken) {
		String rotatedToken = jwtProvider.issue(userId, validity, TOKEN_USE);
		Long replaced = redisTemplate.execute(
			ROTATE_SCRIPT,
			List.of(toKey(userId)),
			refreshToken,
			rotatedToken,
			String.valueOf(validity.toMillis()));

		return isApplied(replaced) ? Optional.of(rotatedToken) : Optional.empty();
	}

	/**
	 * 저장 여부와 무관하게 토큰 자체를 검증해 소유자를 반환한다.
	 *
	 * @param refreshToken 확인할 Refresh Token
	 * @return 서명·만료·용도 검증을 통과하면 소유자의 사용자 ID, 아니면 빈 값
	 */
	public Optional<Long> resolveOwner(String refreshToken) {
		return jwtProvider.verify(refreshToken, TOKEN_USE).map(JwtPayload::userId);
	}

	/**
	 * 제시된 토큰이 현재 저장된 토큰일 때만 폐기한다.
	 *
	 * <p>이미 회전된 오래된 토큰으로 로그아웃해도 현재 활성 세션을 지우지 않는다.
	 *
	 * @param userId       토큰 소유자의 사용자 ID
	 * @param refreshToken 폐기 대상으로 제시된 Refresh Token
	 * @return 실제로 폐기했으면 {@code true}, 저장값이 다르거나 없으면 {@code false}
	 */
	public boolean revokeIfCurrent(Long userId, String refreshToken) {
		Long deleted = redisTemplate.execute(REVOKE_SCRIPT, List.of(toKey(userId)), refreshToken);
		return isApplied(deleted);
	}

	/**
	 * 저장된 토큰과 무관하게 해당 사용자의 Refresh Token을 폐기한다.
	 *
	 * <p>탈퇴는 특정 토큰이 아니라 사용자의 세션 자체를 끝내므로, 요청에 실리지 않은 다른 기기의
	 * 토큰까지 함께 끊어야 한다.
	 *
	 * @param userId 토큰 소유자의 사용자 ID
	 */
	public void revoke(Long userId) {
		redisTemplate.delete(toKey(userId));
	}

	private boolean isApplied(Long scriptResult) {
		return scriptResult != null && scriptResult > 0;
	}

	private String toKey(Long userId) {
		return KEY_PREFIX + userId;
	}
}
