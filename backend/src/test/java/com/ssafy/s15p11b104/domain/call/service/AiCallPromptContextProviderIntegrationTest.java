package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.support.IntegrationTest;

@Transactional
class AiCallPromptContextProviderIntegrationTest extends IntegrationTest {

	private static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private static final Instant FIXED_NOW = Instant.parse("2026-07-28T15:30:00Z");
	private static final Instant KST_DAY_START = Instant.parse("2026-07-28T15:00:00Z");
	private static final Instant KST_NEXT_DAY_START = Instant.parse("2026-07-29T15:00:00Z");

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private GroupMemberCallRepository groupMemberRepository;

	@Autowired
	private AiCallPromptContextProvider promptContextProvider;

	@MockitoBean
	private Clock applicationClock;

	@BeforeEach
	void setUpClock() {
		when(applicationClock.withZone(KST)).thenReturn(Clock.fixed(FIXED_NOW, KST));
	}

	@Test
	void loadsOnlyPostsInsideKstDateBoundary() {
		Long groupId = insertGroup("날짜경계", "KST001");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("kst_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long authorId = insertMember(
			groupId,
			insertUser("kst_guardian", "보호자"),
			"GUARDIAN"
		);

		insertSuccessfulPost(groupId, authorId, "시작 직전", KST_DAY_START.minusSeconds(1));
		insertSuccessfulPost(groupId, authorId, "시작 시각", KST_DAY_START);
		insertSuccessfulPost(groupId, authorId, "종료 직전", KST_NEXT_DAY_START.minusSeconds(1));
		insertSuccessfulPost(groupId, authorId, "종료 시각", KST_NEXT_DAY_START);

		AiCallPromptContext context = promptContextProvider.load(loadMember(careReceiverId)).promptContext();

		assertThat(context.careReceiver().currentDateKst()).isEqualTo(LocalDate.of(2026, 7, 29));
		assertThat(context.todayPosts())
			.extracting(AiCallPromptContext.TodayPostContext::summary)
			.containsExactly("시작 시각", "종료 직전");
		assertThat(context.todayPosts())
			.extracting(AiCallPromptContext.TodayPostContext::createdAtKst)
			.containsExactly(
				OffsetDateTime.parse("2026-07-29T00:00:00+09:00"),
				OffsetDateTime.parse("2026-07-29T23:59:59+09:00")
			);
	}

	@Test
	void loadsOnlySuccessfulPostsFromCurrentGroup() {
		Long currentGroupId = insertGroup("현재그룹", "STS001");
		Long careReceiverId = insertMember(
			currentGroupId,
			insertUser("status_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long currentAuthorId = insertMember(
			currentGroupId,
			insertUser("status_guardian", "현재보호자"),
			"GUARDIAN"
		);
		Long otherGroupId = insertGroup("다른그룹", "STS002");
		Long otherAuthorId = insertMember(
			otherGroupId,
			insertUser("status_other", "다른보호자"),
			"GUARDIAN"
		);

		insertSuccessfulPost(currentGroupId, currentAuthorId, "현재 그룹 성공", FIXED_NOW);
		insertPostAnalysis(currentGroupId, currentAuthorId, "현재 그룹 대기", FIXED_NOW, "PENDING", null);
		insertPostAnalysis(currentGroupId, currentAuthorId, "현재 그룹 실패", FIXED_NOW, "FAILED", null);
		insertSuccessfulPost(otherGroupId, otherAuthorId, "다른 그룹 성공", FIXED_NOW);

		AiCallPromptContext context = promptContextProvider.load(loadMember(careReceiverId)).promptContext();

		assertThat(context.todayPosts())
			.extracting(AiCallPromptContext.TodayPostContext::summary)
			.containsExactly("현재 그룹 성공");
	}

	@Test
	void loadsFamilyMemberNamesAndCareReceiverSpecificDisplayNames() {
		Long groupId = insertGroup("가족표시명", "NAME01");
		Long careReceiverId = insertMember(
			groupId,
			insertUser("name_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long aliasedMemberId = insertMember(
			groupId,
			insertUser("name_daughter", "민지"),
			"GUARDIAN"
		);
		Long plainMemberId = insertMember(
			groupId,
			insertUser("name_grandson", "준호"),
			"GUARDIAN"
		);
		insertAlias(groupId, careReceiverId, aliasedMemberId, "딸");

		AiCallSessionContext sessionContext = promptContextProvider.load(loadMember(careReceiverId));
		AiCallPromptContext context = sessionContext.promptContext();

		assertThat(context.familyMembers())
			.extracting(
				AiCallPromptContext.FamilyMemberContext::personKey,
				AiCallPromptContext.FamilyMemberContext::name,
				AiCallPromptContext.FamilyMemberContext::displayName
			)
			.containsExactly(
				tuple("person_1", "민지", "딸"),
				tuple("person_2", "준호", "준호")
			);
		assertThat(sessionContext.personReferences())
			.containsEntry("person_1", new AiCallPersonReference(aliasedMemberId, "민지", "딸"))
			.containsEntry("person_2", new AiCallPersonReference(plainMemberId, "준호", "준호"));
	}

	@Test
	void loadsFiveMostRecentCompletedReportsForCareReceiver() {
		Long currentGroupId = insertGroup("리포트그룹", "RPT001");
		Long careReceiverId = insertMember(
			currentGroupId,
			insertUser("report_receiver", "피보호자"),
			"CARE_RECEIVER"
		);
		Long otherGroupId = insertGroup("다른리포트", "RPT002");
		Long otherCareReceiverId = insertMember(
			otherGroupId,
			insertUser("report_other", "다른사용자"),
			"CARE_RECEIVER"
		);

		insertReport(currentGroupId, careReceiverId, "조회 범위 밖 요약",
			"2026-07-20T10:00:00Z", "COMPLETED");
		insertReport(currentGroupId, careReceiverId, "다섯 번째 요약",
			"2026-07-24T10:00:00Z", "COMPLETED");
		insertReport(currentGroupId, careReceiverId, "네 번째 요약",
			"2026-07-25T10:00:00Z", "COMPLETED");
		insertReport(currentGroupId, careReceiverId, "세 번째 요약",
			"2026-07-26T10:00:00Z", "COMPLETED");
		insertReport(currentGroupId, careReceiverId, "두 번째 요약",
			"2026-07-27T10:00:00Z", "COMPLETED");
		insertReport(currentGroupId, careReceiverId, "최신 요약",
			"2026-07-28T16:30:00Z", "COMPLETED");
		insertReport(otherGroupId, otherCareReceiverId, "다른 피보호자 최신 요약",
			"2026-07-30T10:00:00Z", "COMPLETED");
		insertReport(currentGroupId, careReceiverId, "완료되지 않은 최신 통화 요약",
			"2026-07-31T10:00:00Z", "INCOMPLETE");

		AiCallPromptContext context = promptContextProvider.load(loadMember(careReceiverId)).promptContext();

		assertThat(context.recentCalls())
			.extracting(
				AiCallPromptContext.RecentCallContext::summary,
				AiCallPromptContext.RecentCallContext::endedDateKst
			)
			.containsExactly(
				tuple("최신 요약", LocalDate.of(2026, 7, 29)),
				tuple("두 번째 요약", LocalDate.of(2026, 7, 27)),
				tuple("세 번째 요약", LocalDate.of(2026, 7, 26)),
				tuple("네 번째 요약", LocalDate.of(2026, 7, 25)),
				tuple("다섯 번째 요약", LocalDate.of(2026, 7, 24))
			);
	}

	private Long insertGroup(String name, String inviteCode) {
		return jdbcTemplate.queryForObject("""
			insert into family_groups (name, invite_code)
			values (?, ?)
			returning id
			""", Long.class, name, inviteCode);
	}

	private Long insertUser(String loginId, String name) {
		return jdbcTemplate.queryForObject("""
			insert into users (login_id, password_hash, name, birth_date, gender)
			values (?, 'unused', ?, date '1950-01-01', 'FEMALE')
			returning id
			""", Long.class, loginId, name);
	}

	private Long insertMember(Long groupId, Long userId, String role) {
		return jdbcTemplate.queryForObject("""
			insert into group_members (group_id, user_id, role, is_manager, joined_at)
			values (?, ?, cast(? as group_role), false, current_timestamp)
			returning id
			""", Long.class, groupId, userId, role);
	}

	private void insertAlias(Long groupId, Long ownerMemberId, Long targetMemberId, String alias) {
		jdbcTemplate.update("""
			insert into member_aliases (group_id, owner_member_id, target_member_id, alias)
			values (?, ?, ?, ?)
			""", groupId, ownerMemberId, targetMemberId, alias);
	}

	private void insertSuccessfulPost(Long groupId, Long authorId, String summary, Instant createdAt) {
		insertPostAnalysis(groupId, authorId, summary, createdAt, "SUCCESS", summary);
	}

	private void insertPostAnalysis(
		Long groupId,
		Long authorId,
		String content,
		Instant createdAt,
		String status,
		String summary
	) {
		Long postId = jdbcTemplate.queryForObject("""
			insert into posts (group_id, author_member_id, content, created_at, updated_at)
			values (?, ?, ?, ?, ?)
			returning id
			""", Long.class, groupId, authorId, content, Timestamp.from(createdAt), Timestamp.from(createdAt));
		Timestamp analyzedAt = summary == null ? null : Timestamp.from(createdAt);
		jdbcTemplate.update("""
			insert into post_analyses (post_id, status, summary, analyzed_at)
			values (?, cast(? as analysis_status), ?, ?)
			""", postId, status, summary, analyzedAt);
	}

	private void insertReport(
		Long groupId,
		Long careReceiverId,
		String summary,
		String endedAt,
		String status
	) {
		Timestamp endedTimestamp = endedAt == null ? null : Timestamp.from(Instant.parse(endedAt));
		Long sessionId = jdbcTemplate.queryForObject("""
			insert into call_sessions (
				group_id,
				care_receiver_member_id,
				persona_id,
				status,
				ended_at
			)
			values (?, ?, 1, cast(? as call_status), ?)
			returning id
			""", Long.class, groupId, careReceiverId, status, endedTimestamp);
		jdbcTemplate.update("""
			insert into call_reports (
				call_session_id,
				summary,
				emotion_category,
				emotion_subcategory
			)
			values (?, ?, 'NEUTRAL', 'CALM')
			""", sessionId, summary);
	}

	private GroupMember loadMember(Long memberId) {
		return groupMemberRepository.findById(memberId).orElseThrow();
	}
}
