package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductionAiCredentialConfigurationTests {

	@Test
	void productionRequiresGmsApiKeyInSpringAndCompose() throws IOException {
		String profile = Files.readString(Path.of("src/main/resources/application-prod.yml"));
		String compose = Files.readString(Path.of("../infrastructure/production/compose.prod.yml"));

		assertThat(profile).contains("api-key: ${GMS_API_KEY}");
		assertThat(profile).doesNotContain("api-key: ${GMS_API_KEY:}");
		assertThat(compose).contains("GMS_API_KEY: ${GMS_API_KEY:?GMS_API_KEY is required}");
	}
}
