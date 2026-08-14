package com.ssafy.s15p11b104.domain.call.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Profiles;

import com.ssafy.s15p11b104.domain.call.controller.AiCallDevReportController;
import com.ssafy.s15p11b104.domain.call.controller.AiCallWebController;
import com.ssafy.s15p11b104.domain.call.service.AiCallDevReportService;
import com.ssafy.s15p11b104.domain.call.service.DevCallActorResolver;
import com.ssafy.s15p11b104.domain.call.service.JwtCallActorResolver;

class AiCallProfileActivationTest {

	private static final String DEV_PROFILE_EXPRESSION = "local & ai-call-dev";
	private static final String JWT_PROFILE_EXPRESSION = "!local | !ai-call-dev";

	@Test
	void activatesDevelopmentComponentsOnlyForLocalAiCallDevelopment() {
		assertProfileExpression(AiCallDevDataInitializer.class, DEV_PROFILE_EXPRESSION);
		assertProfileExpression(AiCallDevWebSecurityConfig.class, DEV_PROFILE_EXPRESSION);
		assertProfileExpression(AiCallWebController.class, DEV_PROFILE_EXPRESSION);
		assertProfileExpression(AiCallDevReportController.class, DEV_PROFILE_EXPRESSION);
		assertProfileExpression(AiCallDevReportService.class, DEV_PROFILE_EXPRESSION);
		assertProfileExpression(DevCallActorResolver.class, DEV_PROFILE_EXPRESSION);

		assertThat(matches(DEV_PROFILE_EXPRESSION, "local", "ai-call-dev")).isTrue();
		assertThat(matches(DEV_PROFILE_EXPRESSION, "ai-call-dev")).isFalse();
		assertThat(matches(DEV_PROFILE_EXPRESSION, "local")).isFalse();
		assertThat(matches(DEV_PROFILE_EXPRESSION, "prod", "ai-call-dev")).isFalse();
	}

	@Test
	void keepsJwtActorUnlessLocalDevelopmentHarnessIsActive() {
		assertProfileExpression(JwtCallActorResolver.class, JWT_PROFILE_EXPRESSION);

		assertThat(matches(JWT_PROFILE_EXPRESSION, "local", "ai-call-dev")).isFalse();
		assertThat(matches(JWT_PROFILE_EXPRESSION, "ai-call-dev")).isTrue();
		assertThat(matches(JWT_PROFILE_EXPRESSION, "local")).isTrue();
		assertThat(matches(JWT_PROFILE_EXPRESSION, "prod", "ai-call-dev")).isTrue();
	}

	private void assertProfileExpression(Class<?> type, String expected) {
		Profile profile = type.getAnnotation(Profile.class);

		assertThat(profile).isNotNull();
		assertThat(profile.value()).containsExactly(expected);
	}

	private boolean matches(String expression, String... activeProfiles) {
		Set<String> active = Set.of(activeProfiles);
		return Profiles.of(expression).matches(active::contains);
	}
}
