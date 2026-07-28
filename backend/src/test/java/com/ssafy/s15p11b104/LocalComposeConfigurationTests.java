package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class LocalComposeConfigurationTests {

	@Test
	void localComposeDefinesPostgresAndRedis() throws IOException {
		String composeYaml = Files.readString(Path.of("compose.local.yml"));
		Map<?, ?> compose = new Yaml().load(composeYaml);
		Map<?, ?> services = (Map<?, ?>) compose.get("services");

		assertThat(services.containsKey("postgres")).isTrue();
		assertThat(services.containsKey("redis")).isTrue();
	}
}
