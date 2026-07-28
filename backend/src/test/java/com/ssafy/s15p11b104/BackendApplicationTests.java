package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.s15p11b104.support.IntegrationTest;

class BackendApplicationTests extends IntegrationTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private StringRedisTemplate redisTemplate;

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
