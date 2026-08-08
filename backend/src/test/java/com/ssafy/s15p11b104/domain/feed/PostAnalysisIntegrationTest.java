package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisGateway;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisService;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@Transactional
class PostAnalysisIntegrationTest extends IntegrationTest {

	private static final Instant STABLE_UPDATED_AT = Instant.parse("2026-07-29T00:00:00Z");

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private PostAnalysisRepository postAnalysisRepository;

	@Autowired
	private PostAnalysisService postAnalysisService;

	@MockitoBean
	private PostAnalysisGateway postAnalysisGateway;

	@BeforeEach
	void setUp() {
		postAnalysisRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();
	}

	@Test
	void stablePostStoresSuccessResult() {
		Post post = createStablePost(1L);
		when(postAnalysisGateway.analyze(post.getId())).thenReturn("  통화에 사용할 게시글 요약  ");

		postAnalysisService.analyzeStablePosts();
		entityManager.flush();
		entityManager.clear();

		PostAnalysis analysis = postAnalysisRepository.findByPostId(post.getId()).orElseThrow();
		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.SUCCESS);
		assertThat(analysis.getSummary()).isEqualTo("통화에 사용할 게시글 요약");
		assertThat(analysis.getAnalyzedAt()).isNotNull();
	}

	@Test
	void newlyCreatedPostIsAnalyzedWithoutStabilityDelay() {
		Post post = createPost(4L);
		when(postAnalysisGateway.analyze(post.getId())).thenReturn("방금 작성한 게시글 요약");

		postAnalysisService.analyzeStablePosts();
		entityManager.flush();
		entityManager.clear();

		PostAnalysis analysis = postAnalysisRepository.findByPostId(post.getId()).orElseThrow();
		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.SUCCESS);
		assertThat(analysis.getSummary()).isEqualTo("방금 작성한 게시글 요약");
	}

	@Test
	void gatewayFailureStoresFailedResult() {
		Post post = createStablePost(2L);
		when(postAnalysisGateway.analyze(post.getId())).thenThrow(new IllegalStateException("gateway failure"));

		postAnalysisService.analyzeStablePosts();
		entityManager.flush();
		entityManager.clear();

		PostAnalysis analysis = postAnalysisRepository.findByPostId(post.getId()).orElseThrow();
		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
		assertThat(analysis.getSummary()).isNull();
		assertThat(analysis.getAnalyzedAt()).isNull();
	}

	@Test
	void successfulPostIsNotSelectedAgain() {
		Post post = createStablePost(3L);
		PostAnalysis existing = postAnalysisRepository.save(new PostAnalysis(post, AnalysisStatus.PENDING));
		existing.complete("기존 요약", Instant.now());
		entityManager.flush();

		postAnalysisService.analyzeStablePosts();

		assertThat(postAnalysisRepository.findByPostId(post.getId()).orElseThrow().getSummary())
			.isEqualTo("기존 요약");
		org.mockito.Mockito.verifyNoInteractions(postAnalysisGateway);
	}

	private Post createStablePost(Long inviteCodeSuffix) {
		Post post = createPost(inviteCodeSuffix);
		jdbcTemplate.update(
			"update posts set updated_at = ? where id = ?",
			Timestamp.from(STABLE_UPDATED_AT),
			post.getId());
		entityManager.clear();
		return postRepository.findById(post.getId()).orElseThrow();
	}

	private Post createPost(Long inviteCodeSuffix) {
		User user = userRepository.save(new User(
			"analysis_user_" + inviteCodeSuffix,
			"password-hash",
			"분석 사용자",
			LocalDate.of(1995, 3, 17),
			UserGender.MALE));
		FamilyGroup group = entityManager.merge(new FamilyGroup("분석 그룹", String.format("A%05d", inviteCodeSuffix)));
		entityManager.flush();
		GroupMember member = groupMemberRepository.save(
			new GroupMember(group, user, GroupRole.GUARDIAN, true, Instant.now()));
		Post post = postRepository.save(new Post(group, member, "분석할 게시글"));
		entityManager.flush();
		entityManager.clear();
		return postRepository.findById(post.getId()).orElseThrow();
	}
}
