package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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
			"calendar_events", "event_participants", "call_sessions", "call_transcript_events",
			"call_transcripts", "call_report_generation_requests", "call_reports", "daily_reports",
			"daily_report_generation_claims", "carnations", "notifications",
			"notification_settings", "device_tokens");
	}

	@Test
	void transcriptIntegritySchemaMatchesContract() {
		Map<String, Object> integrityColumn = jdbcTemplate.queryForMap(
			"SELECT udt_name, is_nullable FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'call_sessions' "
				+ "AND column_name = 'transcript_integrity_status'");
		Map<String, Object> eventStatusColumn = jdbcTemplate.queryForMap(
			"SELECT udt_name, is_nullable FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'call_transcript_events' "
				+ "AND column_name = 'status'");
		String triggerDefinition = jdbcTemplate.queryForObject(
			"SELECT pg_get_triggerdef(oid) FROM pg_trigger "
				+ "WHERE tgname = 'trg_call_reports_transcript_integrity'",
			String.class);
		String retryIndexDefinition = jdbcTemplate.queryForObject(
			"SELECT indexdef FROM pg_indexes "
				+ "WHERE schemaname = 'public' AND indexname = 'idx_call_transcript_events_retry'",
			String.class);

		assertThat(integrityColumn)
			.containsEntry("udt_name", "transcript_integrity_status")
			.containsEntry("is_nullable", "NO");
		assertThat(eventStatusColumn)
			.containsEntry("udt_name", "transcript_ingest_status")
			.containsEntry("is_nullable", "NO");
		assertThat(triggerDefinition)
			.contains("BEFORE INSERT OR UPDATE")
			.contains("enforce_call_report_transcript_integrity()");
		assertThat(retryIndexDefinition)
			.contains("status")
			.contains("next_attempt_at")
			.contains("claim_expires_at")
			.contains("WHERE (status = 'READY'::transcript_ingest_status)");
	}

	@Test
	void notificationReminderSlotSchemaMatchesContract() {
		String enumType = jdbcTemplate.queryForObject(
			"SELECT udt_name FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'notifications' "
				+ "AND column_name = 'reminder_slot'",
			String.class);
		String indexDefinition = jdbcTemplate.queryForObject(
			"SELECT indexdef FROM pg_indexes "
				+ "WHERE schemaname = 'public' AND indexname = 'uq_event_reminder_notification'",
			String.class);

		assertThat(enumType).isEqualTo("reminder_slot");
		assertThat(indexDefinition)
			.contains("(receiver_user_id, related_event_id, type, reminder_slot)")
			.contains("NULLS NOT DISTINCT")
			.contains("EVENT_REMINDER");
	}

	@Test
	void notificationSourceEventSchemaMatchesContract() {
		String dataType = jdbcTemplate.queryForObject(
			"SELECT data_type FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'notifications' "
				+ "AND column_name = 'source_event_key'",
			String.class);
		Integer length = jdbcTemplate.queryForObject(
			"SELECT character_maximum_length FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'notifications' "
				+ "AND column_name = 'source_event_key'",
			Integer.class);
		String indexDefinition = jdbcTemplate.queryForObject(
			"SELECT indexdef FROM pg_indexes "
				+ "WHERE schemaname = 'public' AND indexname = 'uq_notifications_receiver_source_event'",
			String.class);

		assertThat(dataType).isEqualTo("character varying");
		assertThat(length).isEqualTo(160);
		assertThat(indexDefinition)
			.contains("(receiver_user_id, source_event_key)")
			.contains("source_event_key IS NOT NULL");
	}

	@Test
	void calendarReminderScheduleTimestampMatchesContract() {
		Map<String, Object> column = jdbcTemplate.queryForMap(
			"SELECT data_type, is_nullable FROM information_schema.columns "
				+ "WHERE table_schema = 'public' AND table_name = 'calendar_events' "
				+ "AND column_name = 'reminder_schedule_updated_at'");

		assertThat(column)
			.containsEntry("data_type", "timestamp with time zone")
			.containsEntry("is_nullable", "NO");
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

		Long authorUserId = jdbcTemplate.queryForObject("""
			INSERT INTO users (login_id, password_hash, name, birth_date, gender)
			VALUES ('call-test-fam', 'unused', '작성자', DATE '1980-01-01', 'FEMALE')
			RETURNING id
			""", Long.class);
		Long authorMemberId = jdbcTemplate.queryForObject("""
			INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at)
			VALUES (?, ?, 'GUARDIAN', FALSE, CURRENT_TIMESTAMP)
			RETURNING id
			""", Long.class, groupId, authorUserId);
		Long postId = jdbcTemplate.queryForObject("""
			INSERT INTO posts (group_id, author_member_id, content)
			VALUES (?, ?, '테스트 게시글')
			RETURNING id
			""", Long.class, groupId, authorMemberId);
		jdbcTemplate.update("""
			INSERT INTO post_analyses (post_id, status, summary, analyzed_at)
			VALUES (?, 'SUCCESS', '테스트 게시글 요약', CURRENT_TIMESTAMP)
			""", postId);

		var analyses = postAnalysisRepository.findSuccessfulTodayExcludingAuthor(
			groupId,
			member.orElseThrow().getId(),
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
