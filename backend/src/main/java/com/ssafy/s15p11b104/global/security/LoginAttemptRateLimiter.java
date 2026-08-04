package com.ssafy.s15p11b104.global.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/** 로그인 실패 횟수와 일시 차단을 Redis에서 원자적으로 관리한다. */
@Component
public class LoginAttemptRateLimiter {

	private static final long WINDOW_SECONDS = 15 * 60;
	private static final long MAX_BACKOFF_SECONDS = 300;
	private static final long THRESHOLD = 5;
	private static final RedisScript<Long> CHECK_SCRIPT = RedisScript.of("""
		local ttl = redis.call('TTL', KEYS[1])
		if ttl and ttl > 0 then return ttl end
		return 0
		""", Long.class);
	private static final RedisScript<Long> RECORD_FAILURE_SCRIPT = RedisScript.of("""
		local count = redis.call('INCR', KEYS[1])
		if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
		if count < tonumber(ARGV[2]) then return 0 end
		local exponent = count - tonumber(ARGV[2])
		local seconds = 1
		for i = 1, exponent do
			seconds = math.min(seconds * 2, tonumber(ARGV[3]))
		end
		redis.call('SET', KEYS[2], '1', 'EX', seconds)
		return seconds
		""", Long.class);
	private static final RedisScript<Long> CLEAR_SCRIPT = RedisScript.of("""
		return redis.call('DEL', KEYS[1], KEYS[2])
		""", Long.class);

	private final StringRedisTemplate redisTemplate;

	LoginAttemptRateLimiter(StringRedisTemplate redisTemplate) {
		this.redisTemplate = redisTemplate;
	}

	public void ensureAllowed(String loginId, String source) {
		List<String> keys = keys(loginId, source);
		Long retryAfter = redisTemplate.execute(CHECK_SCRIPT, List.of(keys.get(1)));
		if (retryAfter != null && retryAfter > 0) {
			throw new BusinessException(ErrorCode.LOGIN_RATE_LIMITED, retryAfter.intValue());
		}
	}

	public void recordFailure(String loginId, String source) {
		List<String> keys = keys(loginId, source);
		redisTemplate.execute(
			RECORD_FAILURE_SCRIPT,
			keys,
			String.valueOf(WINDOW_SECONDS),
			String.valueOf(THRESHOLD),
			String.valueOf(MAX_BACKOFF_SECONDS));
	}

	public void clear(String loginId, String source) {
		redisTemplate.execute(CLEAR_SCRIPT, keys(loginId, source));
	}

	private List<String> keys(String loginId, String source) {
		String identity = sha256(loginId + "\n" + source);
		return List.of("login-rate:failure:" + identity, "login-rate:block:" + identity);
	}

	private String sha256(String value) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
				.digest(value.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is required", exception);
		}
	}
}
