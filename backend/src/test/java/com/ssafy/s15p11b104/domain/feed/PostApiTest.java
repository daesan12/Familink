package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class PostApiTest extends IntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private PostMediaRepository postMediaRepository;

	@Autowired
	private PostAnalysisRepository postAnalysisRepository;

	private FamilyGroup group;
	private GroupMember authorMember;
	private GroupMember otherMember;

	@BeforeEach
	void setUp() {
		postAnalysisRepository.deleteAll();
		postMediaRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User author = userRepository.save(user("post_author", "작성자"));
		User other = userRepository.save(user("post_other", "다른사람"));
		group = entityManager.merge(new FamilyGroup("family", "ABC123"));
		entityManager.flush();
		authorMember = groupMemberRepository.save(
			new GroupMember(group, author, GroupRole.GUARDIAN, true, Instant.now()));
		otherMember = groupMemberRepository.save(
			new GroupMember(group, other, GroupRole.CARE_RECEIVER, false, Instant.now()));
		entityManager.flush();
	}

	@Test
	void activeMemberCanCreateTextPost() throws Exception {
		mockMvc.perform(post("/posts")
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(createJson(List.of(group.getId()), "안녕하세요", null, List.of())))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.posts[0].groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.posts[0].postId").isNumber());

		assertThat(postRepository.count()).isEqualTo(1);
		assertThat(postMediaRepository.count()).isZero();
	}

	@Test
	void imagePostStoresMediaInDisplayOrder() throws Exception {
		mockMvc.perform(post("/posts")
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(createJson(
					List.of(group.getId()),
					"사진입니다",
					"IMAGE",
					List.of(media("https://cdn/2.jpg", 1), media("https://cdn/1.jpg", 0)))))
			.andExpect(status().isCreated());

		assertThat(postMediaRepository.findAll())
			.extracting(PostMedia::getMediaType, PostMedia::getDisplayOrder)
			.containsExactlyInAnyOrder(
				org.assertj.core.groups.Tuple.tuple(MediaType.IMAGE, 0),
				org.assertj.core.groups.Tuple.tuple(MediaType.IMAGE, 1));
	}

	@Test
	void duplicateGroupIdsAreRejectedWithoutPartialPosts() throws Exception {
		mockMvc.perform(post("/posts")
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(createJson(List.of(group.getId(), group.getId()), "중복 그룹", null, List.of())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		assertThat(postRepository.count()).isZero();
	}

	@Test
	void authorCanUpdateAndReplaceMedia() throws Exception {
		Post post = postRepository.save(new Post(group, authorMember, "이전 글"));
		postMediaRepository.save(new PostMedia(post, MediaType.IMAGE, "https://cdn/old.jpg", 0, null));
		entityManager.flush();

		mockMvc.perform(patch("/posts/{postId}", post.getId())
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(updateJson("새 글", "VIDEO", List.of(media("https://cdn/new.mp4", 0)))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(post.getId()))
			.andExpect(jsonPath("$.data.updatedAt").isString());

		entityManager.clear();
		assertThat(postRepository.findById(post.getId()).orElseThrow().getContent()).isEqualTo("새 글");
		assertThat(postMediaRepository.findAll()).singleElement()
			.satisfies(media -> {
				assertThat(media.getMediaType()).isEqualTo(MediaType.VIDEO);
				assertThat(media.getFileUrl()).isEqualTo("https://cdn/new.mp4");
			});
	}

	@Test
	void updatingPostResetsExistingAnalysis() throws Exception {
		Post post = postRepository.save(new Post(group, authorMember, "분석 전 글"));
		PostAnalysis analysis = postAnalysisRepository.save(new PostAnalysis(post, AnalysisStatus.PENDING));
		analysis.complete("기존 요약", Instant.now());
		entityManager.flush();

		mockMvc.perform(patch("/posts/{postId}", post.getId())
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(updateJson("수정된 글", null, List.of())))
			.andExpect(status().isOk());

		entityManager.clear();
		PostAnalysis reset = postAnalysisRepository.findByPostId(post.getId()).orElseThrow();
		assertThat(reset.getStatus()).isEqualTo(AnalysisStatus.PENDING);
		assertThat(reset.getSummary()).isNull();
		assertThat(reset.getAnalyzedAt()).isNull();
	}

	@Test
	void onlyAuthorCanUpdateOrDelete() throws Exception {
		Post post = postRepository.save(new Post(group, authorMember, "원문"));
		entityManager.flush();

		mockMvc.perform(patch("/posts/{postId}", post.getId())
				.with(authenticatedAs(otherMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(updateJson("변경", null, List.of())))
			.andExpect(status().isForbidden());

		mockMvc.perform(delete("/posts/{postId}", post.getId())
				.with(authenticatedAs(otherMember.getUser().getId())))
			.andExpect(status().isForbidden());
	}

	@Test
	void authorWhoLeftGroupCannotUpdateOrDelete() throws Exception {
		Post post = postRepository.save(new Post(group, authorMember, "탈퇴 전 글"));
		entityManager.flush();
		entityManager.createQuery("""
			update GroupMember member
			set member.leftAt = :leftAt
			where member.id = :memberId
			""")
			.setParameter("leftAt", Instant.now())
			.setParameter("memberId", authorMember.getId())
			.executeUpdate();
		entityManager.clear();

		mockMvc.perform(patch("/posts/{postId}", post.getId())
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(updateJson("변경", null, List.of())))
			.andExpect(status().isForbidden());

		mockMvc.perform(delete("/posts/{postId}", post.getId())
				.with(authenticatedAs(authorMember.getUser().getId())))
			.andExpect(status().isForbidden());
	}

	@Test
	void authorCanDeletePost() throws Exception {
		Post post = postRepository.save(new Post(group, authorMember, "삭제할 글"));
		postMediaRepository.save(new PostMedia(post, MediaType.IMAGE, "https://cdn/image.jpg", 0, null));
		entityManager.flush();

		mockMvc.perform(delete("/posts/{postId}", post.getId())
				.with(authenticatedAs(authorMember.getUser().getId())))
			.andExpect(status().isNoContent());

		entityManager.flush();
		assertThat(postRepository.findById(post.getId())).isEmpty();
		assertThat(postMediaRepository.count()).isZero();
	}

	@Test
	void invalidMediaRulesAreRejected() throws Exception {
		mockMvc.perform(post("/posts")
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(createJson(List.of(group.getId()), "본문", "IMAGE", List.of())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(post("/posts")
				.with(authenticatedAs(authorMember.getUser().getId()))
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(createJson(List.of(group.getId()), "본문", "VIDEO",
					List.of(media("https://cdn/1.mp4", 0), media("https://cdn/2.mp4", 1)))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void unauthenticatedRequestIsUnauthorized() throws Exception {
		mockMvc.perform(post("/posts")
				.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
				.content(createJson(List.of(group.getId()), "본문", null, List.of())))
			.andExpect(status().isUnauthorized());
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private String createJson(List<Long> groupIds, String content, String mediaType, List<String> media)
		throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("groupIds", groupIds);
		body.put("content", content);
		body.put("mediaType", mediaType);
		body.put("media", media.stream().map(item -> readTree(item)).toList());
		return objectMapper.writeValueAsString(body);
	}

	private String updateJson(String content, String mediaType, List<String> media) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("content", content);
		body.put("mediaType", mediaType);
		body.put("media", media.stream().map(item -> readTree(item)).toList());
		return objectMapper.writeValueAsString(body);
	}

	private com.fasterxml.jackson.databind.JsonNode readTree(String value) {
		try {
			return objectMapper.readTree(value);
		} catch (Exception exception) {
			throw new IllegalArgumentException(exception);
		}
	}

	private String media(String fileUrl, int displayOrder) throws Exception {
		return objectMapper.writeValueAsString(java.util.Map.of(
			"fileUrl", fileUrl,
			"displayOrder", displayOrder));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
