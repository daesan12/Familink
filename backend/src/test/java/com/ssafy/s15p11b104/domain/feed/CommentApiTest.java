package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Comment;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class CommentApiTest extends IntegrationTest {

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
	private MemberAliasRepository memberAliasRepository;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private CommentRepository commentRepository;

	@MockitoBean
	private MediaDownloadUrlProvider mediaDownloadUrlProvider;

	private FamilyGroup group;
	private GroupMember author;
	private GroupMember viewer;
	private Post post;

	@BeforeEach
	void setUp() {
		memberAliasRepository.deleteAll();
		commentRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User authorUser = userRepository.save(user("comment_author", "작성자"));
		User viewerUser = userRepository.save(user("comment_viewer", "조회자"));
		User outsiderUser = userRepository.save(user("com_outsider", "외부인"));
		group = entityManager.merge(new FamilyGroup("family", "COM001"));
		FamilyGroup otherGroup = entityManager.merge(new FamilyGroup("other", "COM002"));
		entityManager.flush();
		author = groupMemberRepository.save(
			new GroupMember(group, authorUser, GroupRole.GUARDIAN, true, Instant.now()));
		viewer = groupMemberRepository.save(
			new GroupMember(group, viewerUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		groupMemberRepository.save(
			new GroupMember(otherGroup, outsiderUser, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();
		post = postRepository.save(new Post(group, author, "게시글"));
		entityManager.flush();
	}

	@Test
	void activeMemberCanListAndCreateComments() throws Exception {
		viewer.getUser().updateProfileImageUrl("https://cdn/profile-image/commenter.jpg");
		userRepository.flush();
		given(mediaDownloadUrlProvider.issueProfileImageDownloadUrl(
			"https://cdn/profile-image/commenter.jpg"))
			.willReturn("https://signed.example/commenter.jpg");

		mockMvc.perform(post("/posts/{postId}/comments", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("새 댓글")))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.id").isNumber())
			.andExpect(jsonPath("$.data.postId").value(post.getId()))
			.andExpect(jsonPath("$.data.content").value("새 댓글"))
			.andExpect(jsonPath("$.data.createdAt").isString());

		mockMvc.perform(get("/posts/{postId}/comments", post.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content.length()").value(1))
			.andExpect(jsonPath("$.data.content[0].author.memberId").value(viewer.getId()))
			.andExpect(jsonPath("$.data.content[0].author.profileImageUrl")
				.value("https://signed.example/commenter.jpg"))
			.andExpect(jsonPath("$.data.content[0].content").value("새 댓글"))
			.andExpect(jsonPath("$.data.content[0].updatedAt").isString());

		verify(mediaDownloadUrlProvider).issueProfileImageDownloadUrl(
			"https://cdn/profile-image/commenter.jpg");
		assertThat(userRepository.findById(viewer.getUser().getId()).orElseThrow().getProfileImageUrl())
			.isEqualTo("https://cdn/profile-image/commenter.jpg");
	}

	@Test
	void onlyCommentAuthorCanUpdateAndDelete() throws Exception {
		Comment comment = commentRepository.save(new Comment(post, author, "원문"));
		entityManager.flush();

		mockMvc.perform(patch("/comments/{commentId}", comment.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("변경")))
			.andExpect(status().isForbidden());

		mockMvc.perform(patch("/comments/{commentId}", comment.getId())
				.with(authenticatedAs(author.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("변경")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(comment.getId()))
			.andExpect(jsonPath("$.data.content").value("변경"))
			.andExpect(jsonPath("$.data.updatedAt").isString());

		mockMvc.perform(delete("/comments/{commentId}", comment.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isForbidden());

		mockMvc.perform(delete("/comments/{commentId}", comment.getId())
				.with(authenticatedAs(author.getUser().getId())))
			.andExpect(status().isNoContent());
		entityManager.flush();
		assertThat(commentRepository.findById(comment.getId())).isEmpty();
	}

	@Test
	void viewerSpecificAliasIsUsedForCommentAuthor() throws Exception {
		memberAliasRepository.save(new MemberAlias(group, viewer, author, "우리엄마"));
		commentRepository.save(new Comment(post, author, "별칭 댓글"));
		entityManager.flush();

		mockMvc.perform(get("/posts/{postId}/comments", post.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].author.displayName").value("우리엄마"));
	}

	@Test
	void invalidContentIsRejected() throws Exception {
		mockMvc.perform(post("/posts/{postId}/comments", post.getId())
				.with(authenticatedAs(author.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("   ")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(post("/posts/{postId}/comments", post.getId())
				.with(authenticatedAs(author.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("a".repeat(51))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void unauthenticatedAndNonMemberRequestsAreRejected() throws Exception {
		mockMvc.perform(get("/posts/{postId}/comments", post.getId()))
			.andExpect(status().isUnauthorized());

		User outsider = userRepository.save(user("com_out_2", "외부인2"));
		entityManager.flush();
		mockMvc.perform(post("/posts/{postId}/comments", post.getId())
				.with(authenticatedAs(outsider.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json("차단")))
			.andExpect(status().isForbidden());
	}

	@Test
	void pageSizeIsApplied() throws Exception {
		commentRepository.save(new Comment(post, author, "첫 댓글"));
		commentRepository.save(new Comment(post, viewer, "둘째 댓글"));
		entityManager.flush();

		mockMvc.perform(get("/posts/{postId}/comments", post.getId())
				.param("size", "1")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content.length()").value(1))
			.andExpect(jsonPath("$.data.hasNext").value(true));
	}

	private String json(String content) throws Exception {
		return objectMapper.writeValueAsString(Map.of("content", content));
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
