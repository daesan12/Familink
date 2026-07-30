package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.PostAnalysisCallRepository;
import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.support.IntegrationTest;

class BackendApplicationTests extends IntegrationTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@Autowired
	private GroupMemberCallRepository groupMemberRepository;

	@Autowired
	private PostAnalysisCallRepository postAnalysisRepository;

	@Test
	void infrastructureConnectionsAreAvailable() {
		Integer databaseResult = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
		String redisResult = redisTemplate.getConnectionFactory().getConnection().ping();

		assertThat(databaseResult).isEqualTo(1);
		assertThat(redisResult).isEqualTo("PONG");
	}

	@Test
	void calendarEventTimeColumnsAreTimestamptz() {
		List<String> dataTypes = jdbcTemplate.queryForList(
			"SELECT data_type FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'calendar_events' "
				+ "AND column_name IN ('start_at', 'end_at')",
			String.class);

		assertThat(dataTypes).containsExactlyInAnyOrder(
			"timestamp with time zone", "timestamp with time zone");
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

	@Test
	@Transactional
	void bindsCallQueryEnumsUsingPostgreSqlTypes() {
		Long userId = jdbcTemplate.queryForObject("""
			INSERT INTO users (login_id, password_hash, name, birth_date, gender)
			VALUES ('call-test-user', 'unused', '테스트', DATE '1950-01-01', 'MALE')
			RETURNING id
			""", Long.class);
		Long groupId = jdbcTemplate.queryForObject("""
			INSERT INTO family_groups (name, invite_code)
			VALUES ('테스트가족', 'TST001')
			RETURNING id
			""", Long.class);
		jdbcTemplate.update("""
			INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at)
			VALUES (?, ?, 'CARE_RECEIVER', FALSE, CURRENT_TIMESTAMP)
			""", groupId, userId);

		var member = groupMemberRepository.findActiveCareReceiverByLoginId(
			"call-test-user",
			GroupRole.CARE_RECEIVER
		);
		assertThat(member).isPresent();
		assertThat(member.orElseThrow().getRole()).isEqualTo(GroupRole.CARE_RECEIVER);

		Long postId = jdbcTemplate.queryForObject("""
			INSERT INTO posts (group_id, author_member_id, content)
			VALUES (?, ?, '테스트 게시글')
			RETURNING id
			""", Long.class, groupId, member.orElseThrow().getId());
		jdbcTemplate.update("""
			INSERT INTO post_analyses (post_id, status, summary, analyzed_at)
			VALUES (?, 'SUCCESS', '테스트 게시글 요약', CURRENT_TIMESTAMP)
			""", postId);

		var analyses = postAnalysisRepository.findSuccessfulToday(
			groupId,
			AnalysisStatus.SUCCESS,
			Instant.EPOCH,
			Instant.now().plusSeconds(60),
			PageRequest.of(0, 10)
		);

		assertThat(analyses)
			.singleElement()
			.extracting(analysis -> analysis.getSummary())
			.isEqualTo("테스트 게시글 요약");
	}
}
