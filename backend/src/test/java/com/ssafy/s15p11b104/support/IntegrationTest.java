package com.ssafy.s15p11b104.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * 실제 PostgreSQL과 Redis를 사용하는 통합 테스트의 공통 기반이다.
 *
 * <p>컨테이너를 {@code @Container}로 관리하면 테스트 클래스마다 정지·재시작되어 매핑 포트가
 * 바뀐다. 반면 Spring 테스트 컨텍스트는 클래스 사이에서 캐시되므로, 캐시된 컨텍스트가 이미
 * 정지된 컨테이너의 포트를 붙잡는 문제가 생긴다. 이를 막기 위해 컨테이너를 JVM 단위 싱글턴으로
 * 두고 정지하지 않으며, 남은 컨테이너는 Testcontainers의 Ryuk가 정리한다.
 *
 * <p>Docker가 없는 환경에서 그대로 실패하지 않도록 컨테이너 시작은 실행 조건 검사가 끝난 뒤에
 * 호출되는 {@link DynamicPropertySource} 안에서 수행한다. 이미 실행 중이면 시작 요청은 무시된다.
 *
 * <p>전체 테스트를 한 번에 실행하면 서로 다른 설정의 Spring 테스트 컨텍스트가 여러 개 캐시되고
 * 각 컨텍스트가 자신의 커넥션 풀을 유지한다. PostgreSQL 기본 상한인 100개로는 이 합계를 감당하지
 * 못해 통합 테스트가 {@code too many clients already}로 실패하므로 상한을 올린다. 풀 크기를 줄이는
 * 대신 상한을 올리는 이유는 여러 스레드가 동시에 커넥션을 점유하는 동시성 테스트의 전제를
 * 유지하기 위해서다.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
public abstract class IntegrationTest {

	private static final String TEST_REDIS_PASSWORD = "test_redis_password";

	private static final String POSTGRES_MAX_CONNECTIONS = "300";

	private static final PostgreSQLContainer<?> POSTGRES =
		new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"))
			.withCommand("postgres", "-c", "max_connections=" + POSTGRES_MAX_CONNECTIONS);

	private static final GenericContainer<?> REDIS =
		new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine"))
			.withCommand("redis-server", "--requirepass", TEST_REDIS_PASSWORD)
			.withExposedPorts(6379);

	@DynamicPropertySource
	static void containerProperties(DynamicPropertyRegistry registry) {
		POSTGRES.start();
		REDIS.start();

		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", REDIS::getFirstMappedPort);
		registry.add("spring.data.redis.password", () -> TEST_REDIS_PASSWORD);
		registry.add("management.health.redis.enabled", () -> true);
	}

	protected static String postgresJdbcUrl() {
		return POSTGRES.getJdbcUrl();
	}
}
