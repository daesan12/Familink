package com.ssafy.s15p11b104.global.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

class AccessTokenProviderTest {

	private static final String SECRET = "unit-test-access-token-signing-secret-value";

	private final AccessTokenProvider accessTokenProvider = new AccessTokenProvider(
		new AuthTokenProperties(SECRET, Duration.ofMinutes(30), Duration.ofDays(14)));

	@Test
	void issuedTokenCarriesUserIdAsSubject() {
		String token = accessTokenProvider.issue(42L);

		assertThat(parse(token).getSubject()).isEqualTo("42");
	}

	@Test
	void issuedTokenExpiresAfterConfiguredValidity() {
		Instant before = Instant.now();

		Claims claims = parse(accessTokenProvider.issue(42L));

		Duration untilExpiration = Duration.between(before, claims.getExpiration().toInstant());
		assertThat(untilExpiration).isBetween(Duration.ofMinutes(29), Duration.ofMinutes(31));
	}

	@Test
	void validityInSecondsMatchesConfiguredValidity() {
		assertThat(accessTokenProvider.getValidityInSeconds()).isEqualTo(1800L);
	}

	private Claims parse(String token) {
		return Jwts.parser()
			.verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
			.build()
			.parseSignedClaims(token)
			.getPayload();
	}
}
