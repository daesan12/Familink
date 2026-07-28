package com.ssafy.s15p11b104.global.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI serviceOpenApi() {
		return new OpenAPI()
			.info(new Info()
				.title("S15P11B104 API")
				.version("v1")
				.description("가족 소통 서비스 백엔드 API"));
	}
}
