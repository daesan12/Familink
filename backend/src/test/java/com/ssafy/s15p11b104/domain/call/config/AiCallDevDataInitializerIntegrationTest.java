package com.ssafy.s15p11b104.domain.call.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.call.service.AiCallPromptContext;
import com.ssafy.s15p11b104.domain.call.service.AiCallPromptContextProvider;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.support.IntegrationTest;

class AiCallDevDataInitializerIntegrationTest extends IntegrationTest {

	private static final String FIRST_POST_CONTENT = "오늘 점심에 된장국을 맛있게 먹었어요.";
	private static final String SECOND_POST_CONTENT = "주말 야구 경기에서 응원하는 팀이 이겼어요!";
	private static final String UNRELATED_POST_CONTENT = "날짜가 바뀌면 안 되는 일반 게시글";
	private static final Instant STALE_CREATED_AT = Instant.parse("2026-07-20T00:00:00Z");

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private GroupMemberCallRepository groupMemberRepository;

	@Autowired
	private AiCallPromptContextProvider promptContextProvider;

	@Test
	@Transactional
	void refreshesExistingFixturePostsWithoutCreatingDuplicates() {
		AiCallDevDataInitializer initializer = new AiCallDevDataInitializer(jdbcTemplate);
		initializer.run(null);

		Long unrelatedPostId = insertUnrelatedPost();
		markFixturePostsAsStale();

		initializer.run(null);

		assertThat(countFixturePosts()).isEqualTo(2);
		assertThat(countFixturePostAnalyses()).isEqualTo(2);
		assertThat(loadFixtureAnalysisStatuses()).containsExactly("SUCCESS", "SUCCESS");
		assertThat(countRefreshedFixturePosts()).isEqualTo(2);
		assertThat(loadUnrelatedPostCreatedAt(unrelatedPostId)).isEqualTo(STALE_CREATED_AT);

		GroupMember careReceiver = groupMemberRepository.findActiveCareReceiverByLoginId(
			"ai-call-user",
			GroupRole.CARE_RECEIVER
		).orElseThrow();
		AiCallPromptContext context = promptContextProvider.load(careReceiver);

		assertThat(context.todayPosts())
			.extracting(AiCallPromptContext.TodayPostContext::summary)
			.containsExactlyInAnyOrder(
				"민지 딸이 오늘 점심으로 된장국을 먹었다는 소식을 전했습니다.",
				"준호 손자가 주말 야구 경기에서 응원하는 팀이 이겨 기뻤다고 전했습니다."
			);
	}

	private Long insertUnrelatedPost() {
		return jdbcTemplate.queryForObject("""
			insert into posts (group_id, author_member_id, content, created_at, updated_at)
			select family.id, author.id, ?, ?, ?
			from family_groups family
			join group_members author on author.group_id = family.id
			join users author_user on author_user.id = author.user_id
			where family.invite_code = 'AICALL'
				and author_user.login_id = 'ai-guardian-1'
			returning id
			""", Long.class,
			UNRELATED_POST_CONTENT,
			Timestamp.from(STALE_CREATED_AT),
			Timestamp.from(STALE_CREATED_AT));
	}

	private void markFixturePostsAsStale() {
		jdbcTemplate.update("""
			update posts
			set created_at = ?,
				updated_at = ?
			where content in (?, ?)
			""",
			Timestamp.from(STALE_CREATED_AT),
			Timestamp.from(STALE_CREATED_AT),
			FIRST_POST_CONTENT,
			SECOND_POST_CONTENT);
	}

	private int countFixturePosts() {
		return jdbcTemplate.queryForObject("""
			select count(*)
			from posts post
			join family_groups family on family.id = post.group_id
			where family.invite_code = 'AICALL'
				and post.content in (?, ?)
			""", Integer.class, FIRST_POST_CONTENT, SECOND_POST_CONTENT);
	}

	private int countFixturePostAnalyses() {
		return jdbcTemplate.queryForObject("""
			select count(*)
			from post_analyses analysis
			join posts post on post.id = analysis.post_id
			join family_groups family on family.id = post.group_id
			where family.invite_code = 'AICALL'
				and post.content in (?, ?)
			""", Integer.class, FIRST_POST_CONTENT, SECOND_POST_CONTENT);
	}

	private List<String> loadFixtureAnalysisStatuses() {
		return jdbcTemplate.queryForList("""
			select analysis.status::text
			from post_analyses analysis
			join posts post on post.id = analysis.post_id
			join family_groups family on family.id = post.group_id
			where family.invite_code = 'AICALL'
				and post.content in (?, ?)
			order by post.content
			""", String.class, FIRST_POST_CONTENT, SECOND_POST_CONTENT);
	}

	private int countRefreshedFixturePosts() {
		return jdbcTemplate.queryForObject("""
			select count(*)
			from posts post
			join family_groups family on family.id = post.group_id
			where family.invite_code = 'AICALL'
				and post.content in (?, ?)
				and post.created_at > ?
				and post.updated_at > ?
			""", Integer.class,
			FIRST_POST_CONTENT,
			SECOND_POST_CONTENT,
			Timestamp.from(STALE_CREATED_AT),
			Timestamp.from(STALE_CREATED_AT));
	}

	private Instant loadUnrelatedPostCreatedAt(Long postId) {
		return jdbcTemplate.queryForObject(
			"select created_at from posts where id = ?",
			Instant.class,
			postId
		);
	}
}
