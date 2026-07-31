package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.group.dto.GroupDeleteRequest;
import com.ssafy.s15p11b104.domain.group.service.GroupService;
import com.ssafy.s15p11b104.support.IntegrationTest;

class GroupDeletionForeignKeyContractTest extends IntegrationTest {

	private static final String GROUP_SCOPE_FOREIGN_KEYS_SQL = """
		SELECT
			kcu.table_name AS referencing_table,
			kcu.column_name AS referencing_column,
			ccu.table_name AS referenced_table,
			rc.delete_rule
		FROM information_schema.referential_constraints rc
		JOIN information_schema.key_column_usage kcu
			ON kcu.constraint_catalog = rc.constraint_catalog
			AND kcu.constraint_schema = rc.constraint_schema
			AND kcu.constraint_name = rc.constraint_name
		JOIN information_schema.constraint_column_usage ccu
			ON ccu.constraint_catalog = rc.unique_constraint_catalog
			AND ccu.constraint_schema = rc.unique_constraint_schema
			AND ccu.constraint_name = rc.unique_constraint_name
		WHERE kcu.constraint_schema = 'public'
			AND ccu.table_schema = 'public'
			AND ccu.table_name IN ('family_groups', 'group_members')
		ORDER BY ccu.table_name, kcu.table_name, kcu.column_name
		""";

	private static final List<ExpectedForeignKey> APPROVED_GROUP_SCOPE_FOREIGN_KEYS = List.of(
		expected("group_members", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("group_join_requests", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("member_aliases", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("posts", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("calendar_events", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("call_sessions", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("daily_reports", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("carnations", "group_id", "family_groups", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("notifications", "group_id", "family_groups", "SET NULL", CleanupMode.SET_NULL),
		expected("member_aliases", "owner_member_id", "group_members", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected("member_aliases", "target_member_id", "group_members", "NO ACTION", CleanupMode.EXPLICIT_DELETE),
		expected(
			"member_interests",
			"care_receiver_member_id",
			"group_members",
			"NO ACTION",
			CleanupMode.EXPLICIT_DELETE),
		expected("posts", "author_member_id", "group_members", "NO ACTION", CleanupMode.PARENT_ENTITY_DELETE),
		expected("comments", "author_member_id", "group_members", "NO ACTION", CleanupMode.CASCADE),
		expected("post_reactions", "group_member_id", "group_members", "NO ACTION", CleanupMode.CASCADE),
		expected(
			"calendar_events",
			"creator_member_id",
			"group_members",
			"NO ACTION",
			CleanupMode.PARENT_ENTITY_DELETE),
		expected(
			"calendar_events",
			"last_editor_member_id",
			"group_members",
			"NO ACTION",
			CleanupMode.PARENT_ENTITY_DELETE),
		expected("event_participants", "group_member_id", "group_members", "NO ACTION", CleanupMode.CASCADE),
		expected(
			"call_sessions",
			"care_receiver_member_id",
			"group_members",
			"NO ACTION",
			CleanupMode.PARENT_ENTITY_DELETE),
		expected(
			"daily_reports",
			"care_receiver_member_id",
			"group_members",
			"NO ACTION",
			CleanupMode.PARENT_ENTITY_DELETE),
		expected(
			"carnations",
			"group_member_id",
			"group_members",
			"NO ACTION",
			CleanupMode.PARENT_ENTITY_DELETE));

	private static final Set<ForeignKey> APPROVED_SUPPORTING_FOREIGN_KEYS = Set.of(
		foreignKey("post_media", "post_id", "posts", "CASCADE"),
		foreignKey("comments", "post_id", "posts", "CASCADE"),
		foreignKey("post_reactions", "post_id", "posts", "CASCADE"),
		foreignKey("post_analyses", "post_id", "posts", "CASCADE"),
		foreignKey("event_participants", "event_id", "calendar_events", "CASCADE"),
		foreignKey("call_transcripts", "call_session_id", "call_sessions", "CASCADE"),
		foreignKey("call_reports", "call_session_id", "call_sessions", "CASCADE"),
		foreignKey("notifications", "related_join_request_id", "group_join_requests", "SET NULL"),
		foreignKey("notifications", "related_post_id", "posts", "SET NULL"),
		foreignKey("notifications", "related_event_id", "calendar_events", "SET NULL"),
		foreignKey("notifications", "related_call_report_id", "call_reports", "SET NULL"),
		foreignKey("notifications", "related_daily_report_id", "daily_reports", "SET NULL"));

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private GroupService groupService;

	@Test
	void groupScopeForeignKeysMatchApprovedDeletionContract() {
		List<ForeignKey> actual = queryGroupScopeForeignKeys();
		Set<ForeignKey> approved = APPROVED_GROUP_SCOPE_FOREIGN_KEYS.stream()
			.map(ExpectedForeignKey::foreignKey)
			.collect(Collectors.toUnmodifiableSet());

		assertThat(actual)
			.as("승인된 FK별 정리 방식: %s", APPROVED_GROUP_SCOPE_FOREIGN_KEYS)
			.doesNotHaveDuplicates()
			.containsExactlyInAnyOrderElementsOf(approved);
	}

	@Test
	void cascadeAndSetNullForeignKeysKeepTheirDeleteRules() {
		assertThat(queryForeignKeys(APPROVED_SUPPORTING_FOREIGN_KEYS))
			.containsExactlyInAnyOrderElementsOf(APPROVED_SUPPORTING_FOREIGN_KEYS);
	}

	@Test
	@Transactional
	void applicationDeletionPlanCleansEveryApprovedForeignKeyPath() {
		Long managerUserId = insertReturningId(
			"""
				INSERT INTO users (login_id, password_hash, name, birth_date, gender)
				VALUES ('fkguardmanager', 'hash', '관리자', DATE '1950-01-01', 'MALE')
				RETURNING id
				""");
		Long formerUserId = insertReturningId(
			"""
				INSERT INTO users (login_id, password_hash, name, birth_date, gender)
				VALUES ('fkguardformer', 'hash', '이전멤버', DATE '1950-01-01', 'FEMALE')
				RETURNING id
				""");
		Long groupId = insertReturningId(
			"""
				INSERT INTO family_groups (name, invite_code)
				VALUES ('가드가족', 'FK1234')
				RETURNING id
				""");
		Long managerMemberId = insertReturningId(
			"""
				INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at)
				VALUES (?, ?, 'GUARDIAN', TRUE, CURRENT_TIMESTAMP)
				RETURNING id
				""",
			groupId,
			managerUserId);
		Long formerMemberId = insertReturningId(
			"""
				INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at, left_at)
				VALUES (?, ?, 'CARE_RECEIVER', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				RETURNING id
				""",
			groupId,
			formerUserId);
		Long joinRequestId = insertReturningId(
			"""
				INSERT INTO group_join_requests (group_id, applicant_user_id, status)
				VALUES (?, ?, 'PENDING_ADMIN')
				RETURNING id
				""",
			groupId,
			formerUserId);

		jdbcTemplate.update(
			"""
				INSERT INTO member_aliases (group_id, owner_member_id, target_member_id, alias)
				VALUES (?, ?, ?, '가족')
				""",
			groupId,
			managerMemberId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO member_interests (care_receiver_member_id, interest_text)
				VALUES (?, '산책')
				""",
			formerMemberId);

		Long postId = insertReturningId(
			"""
				INSERT INTO posts (group_id, author_member_id, content)
				VALUES (?, ?, '삭제 가드')
				RETURNING id
				""",
			groupId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO post_media (post_id, media_type, file_url, display_order)
				VALUES (?, 'IMAGE', 'https://example.com/guard.jpg', 0)
				""",
			postId);
		jdbcTemplate.update(
			"""
				INSERT INTO comments (post_id, author_member_id, content)
				VALUES (?, ?, '댓글')
				""",
			postId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO post_reactions (post_id, group_member_id, reaction_type)
				VALUES (?, ?, 'HEART')
				""",
			postId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO post_analyses (post_id, status)
				VALUES (?, 'PENDING')
				""",
			postId);

		Long eventId = insertReturningId(
			"""
				INSERT INTO calendar_events (
					group_id, creator_member_id, last_editor_member_id, title, event_date, end_date
				)
				VALUES (?, ?, ?, '일정', DATE '2026-07-30', DATE '2026-07-30')
				RETURNING id
				""",
			groupId,
			managerMemberId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO event_participants (event_id, group_member_id)
				VALUES (?, ?)
				""",
			eventId,
			formerMemberId);

		Long callSessionId = insertReturningId(
			"""
				INSERT INTO call_sessions (
					group_id, care_receiver_member_id, persona_id, status
				)
				VALUES (?, ?, 1, 'COMPLETED')
				RETURNING id
				""",
			groupId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO call_transcripts (
					call_session_id, speaker, content, sequence
				)
				VALUES (?, 'USER', '안녕하세요', 1)
				""",
			callSessionId);
		Long callReportId = insertReturningId(
			"""
				INSERT INTO call_reports (
					call_session_id, summary, emotion_category, emotion_subcategory
				)
				VALUES (?, '요약', 'NEUTRAL', '중립')
				RETURNING id
				""",
			callSessionId);

		Long dailyReportId = insertReturningId(
			"""
				INSERT INTO daily_reports (
					group_id, care_receiver_member_id, report_date, summary,
					emotion_category, emotion_subcategory
				)
				VALUES (?, ?, DATE '2026-07-30', '하루 요약', 'NEUTRAL', '중립')
				RETURNING id
				""",
			groupId,
			formerMemberId);
		jdbcTemplate.update(
			"""
				INSERT INTO carnations (group_id, group_member_id, earned_date)
				VALUES (?, ?, DATE '2026-07-30')
				""",
			groupId,
			formerMemberId);
		Long notificationId = insertReturningId(
			"""
				INSERT INTO notifications (
					receiver_user_id, actor_user_id, group_id, related_join_request_id,
					related_post_id, related_event_id, related_call_report_id,
					related_daily_report_id, type, title, body
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GROUP_JOIN_REQUEST', 'FK guard notification', 'FK guard body')
				RETURNING id
				""",
			managerUserId,
			formerUserId,
			groupId,
			joinRequestId,
			postId,
			eventId,
			callReportId,
			dailyReportId);

		groupService.delete(groupId, managerUserId, new GroupDeleteRequest("가드가족"));

		assertThat(countRows("family_groups")).isZero();
		assertThat(countRows("group_members")).isZero();
		assertThat(countRows("group_join_requests")).isZero();
		assertThat(countRows("member_aliases")).isZero();
		assertThat(countRows("member_interests")).isZero();
		assertThat(countRows("posts")).isZero();
		assertThat(countRows("post_media")).isZero();
		assertThat(countRows("comments")).isZero();
		assertThat(countRows("post_reactions")).isZero();
		assertThat(countRows("post_analyses")).isZero();
		assertThat(countRows("calendar_events")).isZero();
		assertThat(countRows("event_participants")).isZero();
		assertThat(countRows("call_sessions")).isZero();
		assertThat(countRows("call_transcripts")).isZero();
		assertThat(countRows("call_reports")).isZero();
		assertThat(countRows("daily_reports")).isZero();
		assertThat(countRows("carnations")).isZero();
		assertThat(countRows("users")).isEqualTo(2);

		Map<String, Object> preservedNotification = jdbcTemplate.queryForMap(
			"""
				SELECT group_id, related_join_request_id, related_post_id, related_event_id,
					related_call_report_id, related_daily_report_id, title, body
				FROM notifications
				WHERE id = ?
				""",
			notificationId);
		assertThat(preservedNotification)
			.containsEntry("group_id", null)
			.containsEntry("related_join_request_id", null)
			.containsEntry("related_post_id", null)
			.containsEntry("related_event_id", null)
			.containsEntry("related_call_report_id", null)
			.containsEntry("related_daily_report_id", null)
			.containsEntry("title", "FK guard notification")
			.containsEntry("body", "FK guard body");
	}

	private List<ForeignKey> queryGroupScopeForeignKeys() {
		return jdbcTemplate.query(GROUP_SCOPE_FOREIGN_KEYS_SQL, (resultSet, rowNumber) -> new ForeignKey(
			resultSet.getString("referencing_table"),
			resultSet.getString("referencing_column"),
			resultSet.getString("referenced_table"),
			resultSet.getString("delete_rule")));
	}

	private List<ForeignKey> queryForeignKeys(Set<ForeignKey> expectedForeignKeys) {
		return expectedForeignKeys.stream()
			.map(expected -> {
				String deleteRule = jdbcTemplate.queryForObject(
					"""
						SELECT rc.delete_rule
						FROM information_schema.referential_constraints rc
						JOIN information_schema.key_column_usage kcu
							ON kcu.constraint_catalog = rc.constraint_catalog
							AND kcu.constraint_schema = rc.constraint_schema
							AND kcu.constraint_name = rc.constraint_name
						JOIN information_schema.constraint_column_usage ccu
							ON ccu.constraint_catalog = rc.unique_constraint_catalog
							AND ccu.constraint_schema = rc.unique_constraint_schema
							AND ccu.constraint_name = rc.unique_constraint_name
						WHERE kcu.constraint_schema = 'public'
							AND ccu.table_schema = 'public'
							AND kcu.table_name = ?
							AND kcu.column_name = ?
							AND ccu.table_name = ?
						""",
					String.class,
					expected.referencingTable(),
					expected.referencingColumn(),
					expected.referencedTable());
				return new ForeignKey(
					expected.referencingTable(),
					expected.referencingColumn(),
					expected.referencedTable(),
					deleteRule);
			})
			.toList();
	}

	private Long insertReturningId(String sql, Object... arguments) {
		return jdbcTemplate.queryForObject(sql, Long.class, arguments);
	}

	private long countRows(String tableName) {
		Long count = jdbcTemplate.queryForObject("SELECT count(*) FROM " + tableName, Long.class);
		return count == null ? 0 : count;
	}

	private static ExpectedForeignKey expected(
		String referencingTable,
		String referencingColumn,
		String referencedTable,
		String deleteRule,
		CleanupMode cleanupMode
	) {
		return new ExpectedForeignKey(
			foreignKey(referencingTable, referencingColumn, referencedTable, deleteRule),
			cleanupMode);
	}

	private static ForeignKey foreignKey(
		String referencingTable,
		String referencingColumn,
		String referencedTable,
		String deleteRule
	) {
		return new ForeignKey(referencingTable, referencingColumn, referencedTable, deleteRule);
	}

	private enum CleanupMode {
		EXPLICIT_DELETE,
		PARENT_ENTITY_DELETE,
		CASCADE,
		SET_NULL
	}

	private record ExpectedForeignKey(ForeignKey foreignKey, CleanupMode cleanupMode) {
	}

	private record ForeignKey(
		String referencingTable,
		String referencingColumn,
		String referencedTable,
		String deleteRule
	) {
	}
}
