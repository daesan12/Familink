package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class BackendApplicationTests {

	private static final String TEST_REDIS_PASSWORD = "test_redis_password";

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@Container
	@ServiceConnection
	static final PostgreSQLContainer<?> POSTGRES =
		new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Container
	static final GenericContainer<?> REDIS =
		new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine"))
			.withCommand("redis-server", "--requirepass", TEST_REDIS_PASSWORD)
			.withExposedPorts(6379);

	@DynamicPropertySource
	static void redisProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", REDIS::getFirstMappedPort);
		registry.add("spring.data.redis.password", () -> TEST_REDIS_PASSWORD);
		registry.add("management.health.redis.enabled", () -> true);
	}

	@Test
	void infrastructureConnectionsAreAvailable() {
		Integer databaseResult = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
		String redisResult = redisTemplate.getConnectionFactory().getConnection().ping();

		assertThat(databaseResult).isEqualTo(1);
		assertThat(redisResult).isEqualTo("PONG");
	}

	@Test
	void flywayCreatesTheContractTables() {
		Set<String> tableNames = Set.copyOf(jdbcTemplate.queryForList(
			"SELECT table_name FROM information_schema.tables "
				+ "WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history'",
			String.class));

		assertThat(tableNames).containsExactlyInAnyOrder(
			"users", "family_groups", "group_members", "group_join_requests", "member_aliases",
			"member_interests", "posts", "post_media", "comments", "post_reactions", "post_analyses",
			"calendar_events", "event_participants", "call_sessions", "call_transcripts", "call_reports",
			"daily_reports", "carnations", "notifications", "notification_settings", "device_tokens");
	}
}
