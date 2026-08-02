package com.ssafy.s15p11b104.global.security;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableConfigurationProperties(AuthTokenProperties.class)
public class SecurityConfig {

	/**
	 * 인증 없이 호출하는 경로다.
	 *
	 * <p>{@code /auth/reissue}는 Access Token이 만료된 상태에서 호출하므로 공개 경로이며, 계약에 따라
	 * Refresh Token만 검증한다. {@code /auth/logout}은 Access Token 인증이 필요하므로 포함하지 않는다.
	 */
	private static final String[] PUBLIC_ENDPOINTS = {
		"/actuator/health",
		"/actuator/health/**",
		"/v3/api-docs/**",
		"/swagger-ui.html",
		"/swagger-ui/**",
		"/auth/login-id/check",
		"/auth/signup",
		"/auth/login",
		"/auth/reissue"
	};

	private final AccessTokenProvider accessTokenProvider;
	private final AccessTokenBlacklist accessTokenBlacklist;
	private final SecurityErrorResponder securityErrorResponder;

	SecurityConfig(
		AccessTokenProvider accessTokenProvider,
		AccessTokenBlacklist accessTokenBlacklist,
		SecurityErrorResponder securityErrorResponder
	) {
		this.accessTokenProvider = accessTokenProvider;
		this.accessTokenBlacklist = accessTokenBlacklist;
		this.securityErrorResponder = securityErrorResponder;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		return http
			.csrf(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.exceptionHandling(exception -> exception
				.authenticationEntryPoint(securityErrorResponder)
				.accessDeniedHandler(securityErrorResponder))
			.authorizeHttpRequests(authorize -> authorize
				.requestMatchers(PUBLIC_ENDPOINTS).permitAll()
				.anyRequest().authenticated())
			.addFilterBefore(
				new JwtAuthenticationFilter(accessTokenProvider, accessTokenBlacklist),
				UsernamePasswordAuthenticationFilter.class)
			.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}
}
