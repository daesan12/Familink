package com.ssafy.s15p11b104.global.config;

import java.util.Set;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	private static final String BEARER_AUTH = "bearerAuth";
	private static final Set<String> PUBLIC_PATHS = Set.of(
		"/auth/login-id/check",
		"/auth/signup",
		"/auth/login",
		"/auth/reissue");

	@Bean
	OpenAPI serviceOpenApi() {
		return new OpenAPI()
			.components(new Components()
				.addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
					.type(SecurityScheme.Type.HTTP)
					.scheme("bearer")
					.bearerFormat("JWT")))
			.info(new Info()
				.title("S15P11B104 API")
				.version("v1")
				.description("가족 소통 서비스 백엔드 API"));
	}

	@Bean
	OpenApiCustomizer bearerSecurityCustomizer() {
		return openAPI -> openAPI.getPaths().forEach((path, pathItem) -> {
			if (PUBLIC_PATHS.contains(path)) {
				return;
			}
			pathItem.readOperations().forEach(operation -> operation.addSecurityItem(
				new SecurityRequirement().addList(BEARER_AUTH)));
		});
	}
}
