package com.ssafy.s15p11b104.global.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

class AccessTokenProviderTest {

	private static final String SECRET = "unit-test-access-token-signing-secret-value";

	private final AuthTokenProperties properties =
		new AuthTokenProperties(SECRET, Duration.ofMinutes(30), Duration.ofDays(14));
	private final JwtProvider jwtProvider = new JwtProvider(properties);
	private final AccessTokenProvider accessTokenProvider = new AccessTokenProvider(jwtProvider, properties);

	@Test
	void issuedTokenIsVerifiedWithItsOwnerAndExpiry() {
		Instant before = Instant.now();

		String token = accessTokenProvider.issue(42L);

		assertThat(accessTokenProvider.verify(token)).isPresent().get().satisfies(payload -> {
			assertThat(payload.userId()).isEqualTo(42L);
			assertThat(Duration.between(before, payload.expiresAt()))
				.isBetween(Duration.ofMinutes(29), Duration.ofMinutes(31));
		});
	}

	@Test
	void validityInSecondsMatchesConfiguredValidity() {
		assertThat(accessTokenProvider.getValidityInSeconds()).isEqualTo(1800L);
	}

	@Test
	void tamperedTokenIsRejected() {
		String token = accessTokenProvider.issue(42L);

		assertThat(accessTokenProvider.verify(token + "x")).isEmpty();
	}

	@Test
	void tokenSignedWithAnotherSecretIsRejected() {
		AuthTokenProperties otherProperties =
			new AuthTokenProperties("another-secret-value-for-unit-test-only", Duration.ofMinutes(30),
				Duration.ofDays(14));
		String foreignToken = new AccessTokenProvider(new JwtProvider(otherProperties), otherProperties).issue(42L);

		assertThat(accessTokenProvider.verify(foreignToken)).isEmpty();
	}

	@Test
	void expiredTokenIsRejected() {
		AuthTokenProperties expiredProperties =
			new AuthTokenProperties(SECRET, Duration.ofSeconds(-1), Duration.ofDays(14));
		String expiredToken = new AccessTokenProvider(jwtProvider, expiredProperties).issue(42L);

		assertThat(accessTokenProvider.verify(expiredToken)).isEmpty();
	}

	@Test
	void refreshTokenIsNotAcceptedAsAccessToken() {
		String refreshToken = jwtProvider.issue(42L, Duration.ofDays(14), "refresh");

		assertThat(accessTokenProvider.verify(refreshToken)).isEmpty();
	}
}
