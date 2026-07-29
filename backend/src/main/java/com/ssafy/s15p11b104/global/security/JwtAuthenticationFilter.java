package com.ssafy.s15p11b104.global.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Authorization 헤더의 Access Token을 검증해 인증 정보를 설정한다.
 *
 * <p>토큰이 없거나 검증에 실패하면 인증하지 않고 다음 필터로 넘긴다. 인증이 필요한 요청의 거부는
 * Spring Security의 인가 규칙과 {@link SecurityErrorResponder}가 처리한다.
 *
 * <p>블랙리스트 조회는 서명·만료 검증을 통과한 토큰에만 수행한다. 위조된 토큰이 Redis 조회를
 * 유발하지 못하게 하고, 서블릿 필터 체인에 중복 등록되지 않도록 빈으로 노출하지 않는다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	private final AccessTokenProvider accessTokenProvider;
	private final AccessTokenBlacklist accessTokenBlacklist;

	JwtAuthenticationFilter(AccessTokenProvider accessTokenProvider, AccessTokenBlacklist accessTokenBlacklist) {
		this.accessTokenProvider = accessTokenProvider;
		this.accessTokenBlacklist = accessTokenBlacklist;
	}

	@Override
	protected void doFilterInternal(
		HttpServletRequest request,
		HttpServletResponse response,
		FilterChain filterChain
	) throws ServletException, IOException {
		resolveAccessToken(request)
			.flatMap(this::authenticate)
			.ifPresent(authentication -> SecurityContextHolder.getContext().setAuthentication(authentication));

		filterChain.doFilter(request, response);
	}

	private Optional<String> resolveAccessToken(HttpServletRequest request) {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (header == null || !header.startsWith(BEARER_PREFIX)) {
			return Optional.empty();
		}
		return Optional.of(header.substring(BEARER_PREFIX.length()));
	}

	private Optional<Authentication> authenticate(String accessToken) {
		return accessTokenProvider.verify(accessToken)
			.filter(payload -> !accessTokenBlacklist.contains(accessToken))
			.map(payload -> new AuthenticatedUser(payload.userId(), accessToken))
			.map(user -> new UsernamePasswordAuthenticationToken(user, null, List.of()));
	}
}
