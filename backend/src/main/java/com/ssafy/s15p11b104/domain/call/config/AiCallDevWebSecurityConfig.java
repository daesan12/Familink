package com.ssafy.s15p11b104.domain.call.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;

@Configuration
@Profile("local & ai-call-dev")
public class AiCallDevWebSecurityConfig {

	@Bean
	WebSecurityCustomizer aiCallDevWebSecurityCustomizer() {
		return web -> web.ignoring().requestMatchers("/", "/ai-call/**", "/call-sessions/**");
	}
}
