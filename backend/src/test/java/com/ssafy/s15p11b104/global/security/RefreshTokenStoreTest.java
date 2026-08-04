package com.ssafy.s15p11b104.global.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.ssafy.s15p11b104.support.IntegrationTest;

/**
 * 교체와 폐기가 현재 저장된 토큰에만 적용되는지 확인한다.
 *
 * <p>동시 요청은 Redis가 스크립트를 직렬화해 처리하므로, 같은 토큰으로 두 번 시도했을 때 한 번만
 * 성공하는지를 순차 호출로 검증한다.
 */
class RefreshTokenStoreTest extends IntegrationTest {

	private static final Long USER_ID = 1L;
	private static final String STORED_KEY = "refresh:1";

	@Autowired
	private RefreshTokenStore refreshTokenStore;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@BeforeEach
	void resetState() {
		try (RedisConnection connection = redisTemplate.getRequiredConnectionFactory().getConnection()) {
			connection.serverCommands().flushDb();
		}
	}

	@Test
	void rotateSucceedsOnlyOnceForTheSameToken() {
		String issued = refreshTokenStore.issue(USER_ID);

		assertThat(refreshTokenStore.rotate(USER_ID, issued)).isPresent();
		assertThat(refreshTokenStore.rotate(USER_ID, issued)).isEmpty();
	}

	@Test
	void rotateKeepsStoredTokenWhenPresentedTokenIsStale() {
		String stale = refreshTokenStore.issue(USER_ID);
		refreshTokenStore.revokeIfCurrent(USER_ID, stale);
		String current = refreshTokenStore.issue(USER_ID);

		assertThat(refreshTokenStore.rotate(USER_ID, stale)).isEmpty();
		assertThat(redisTemplate.opsForValue().get(STORED_KEY)).isEqualTo(current);
	}

	@Test
	void rotateFailsWhenNothingIsStored() {
		String issued = refreshTokenStore.issue(USER_ID);
		refreshTokenStore.revokeIfCurrent(USER_ID, issued);

		assertThat(refreshTokenStore.rotate(USER_ID, issued)).isEmpty();
		assertThat(redisTemplate.hasKey(STORED_KEY)).isFalse();
	}

	@Test
	void revokeIfCurrentDeletesOnlyTheStoredToken() {
		String stale = refreshTokenStore.issue(USER_ID);
		refreshTokenStore.revokeIfCurrent(USER_ID, stale);
		String current = refreshTokenStore.issue(USER_ID);

		assertThat(refreshTokenStore.revokeIfCurrent(USER_ID, stale)).isFalse();
		assertThat(redisTemplate.hasKey(STORED_KEY)).isTrue();

		assertThat(refreshTokenStore.revokeIfCurrent(USER_ID, current)).isTrue();
		assertThat(redisTemplate.hasKey(STORED_KEY)).isFalse();
	}

	@Test
	void secondIssueIsRejectedWhileSessionIsActive() {
		String first = refreshTokenStore.issue(USER_ID);
		assertThat(refreshTokenStore.issueIfAbsent(USER_ID)).isEmpty();
		assertThat(redisTemplate.opsForValue().get(STORED_KEY)).isEqualTo(first);
	}
}
