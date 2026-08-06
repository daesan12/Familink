package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Comment;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.entity.PostReaction;
import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class PostReadApiTest extends IntegrationTest {

	@Autowired
	private MockMvc mockMvc;

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
	private PostReactionRepository postReactionRepository;

	@Autowired
	private CommentRepository commentRepository;

	@Autowired
	private MemberAliasRepository memberAliasRepository;

	@org.springframework.boot.test.mock.mockito.MockBean
	private MediaDownloadUrlProvider mediaDownloadUrlProvider;

	private FamilyGroup group;
	private FamilyGroup otherGroup;
	private GroupMember viewer;
	private GroupMember author;
	private GroupMember otherGroupMember;
	private Post imagePost;
	private Post textPost;

	@BeforeEach
	void setUp() {
		given(mediaDownloadUrlProvider.issueDownloadUrl(anyString()))
			.willAnswer(invocation -> invocation.getArgument(0));
		commentRepository.deleteAll();
		memberAliasRepository.deleteAll();
		postReactionRepository.deleteAll();
		postMediaRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User viewerUser = userRepository.save(user("read_viewer", "Viewer"));
		User authorUser = userRepository.save(user("read_author", "Author"));
		User outsiderUser = userRepository.save(user("read_outsider", "Outsider"));
		group = entityManager.merge(new FamilyGroup("family", "READ01"));
		otherGroup = entityManager.merge(new FamilyGroup("other", "READ02"));
		entityManager.flush();
		viewer = groupMemberRepository.save(
			new GroupMember(group, viewerUser, GroupRole.GUARDIAN, true, Instant.now()));
		author = groupMemberRepository.save(
			new GroupMember(group, authorUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		otherGroupMember = groupMemberRepository.save(
			new GroupMember(otherGroup, outsiderUser, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();

		textPost = postRepository.save(new Post(group, author, "A text archive post"));
		imagePost = postRepository.save(new Post(group, author, "An image archive post"));
		postMediaRepository.save(new PostMedia(imagePost, MediaType.IMAGE, "https://cdn/image.jpg", 0,
			"https://cdn/thumb.jpg"));
		postReactionRepository.save(new PostReaction(imagePost, viewer, ReactionType.HEART));
		commentRepository.save(new Comment(imagePost, author, "A comment"));
		entityManager.flush();
	}

	@Test
	void activeMemberCanReadPostListWithAggregates() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.param("size", "1")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.content[0].id").value(imagePost.getId()))
			.andExpect(jsonPath("$.data.content[0].media[0].type").value("IMAGE"))
			.andExpect(jsonPath("$.data.content[0].reactionCounts.HEART").value(1))
			.andExpect(jsonPath("$.data.content[0].myReaction").value("HEART"))
			.andExpect(jsonPath("$.data.content[0].commentCount").value(1))
			.andExpect(jsonPath("$.data.hasNext").value(true));
	}

	@Test
	void feedRejectsInvalidPageSizeAndSort() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.param("page", "-1")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.param("size", "101")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.param("sort", "createdAt,asc")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void activeMemberCanReadPostDetail() throws Exception {
		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(imagePost.getId()))
			.andExpect(jsonPath("$.data.groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.author.memberId").value(author.getId()))
			.andExpect(jsonPath("$.data.media[0].thumbnailUrl").value("https://cdn/thumb.jpg"))
			.andExpect(jsonPath("$.data.reactions.HEART").value(1))
			.andExpect(jsonPath("$.data.commentCount").value(1));
	}

	@Test
	void postMediaUrlsAreResolvedThroughDownloadUrlProvider() throws Exception {
		given(mediaDownloadUrlProvider.issueDownloadUrl("https://cdn/image.jpg"))
			.willReturn("https://signed.example/image.jpg");
		given(mediaDownloadUrlProvider.issueDownloadUrl("https://cdn/thumb.jpg"))
			.willReturn("https://signed.example/thumb.jpg");

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.media[0].fileUrl").value("https://signed.example/image.jpg"))
			.andExpect(jsonPath("$.data.media[0].thumbnailUrl").value("https://signed.example/thumb.jpg"));

		verify(mediaDownloadUrlProvider).issueDownloadUrl("https://cdn/image.jpg");
		verify(mediaDownloadUrlProvider).issueDownloadUrl("https://cdn/thumb.jpg");
	}

	@Test
	void postAuthorProfileImageIsResolvedThroughProfileDownloadUrlProvider() throws Exception {
		author.getUser().updateProfileImageUrl("https://cdn/profile-image/author.jpg");
		userRepository.flush();
		given(mediaDownloadUrlProvider.issueProfileImageDownloadUrl(
			"https://cdn/profile-image/author.jpg"))
			.willReturn("https://signed.example/author.jpg");

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.author.profileImageUrl")
				.value("https://signed.example/author.jpg"));

		verify(mediaDownloadUrlProvider).issueProfileImageDownloadUrl(
			"https://cdn/profile-image/author.jpg");
		assertThat(userRepository.findById(author.getUser().getId()).orElseThrow().getProfileImageUrl())
			.isEqualTo("https://cdn/profile-image/author.jpg");
	}

	@Test
	void listAndArchiveMediaUrlsAreResolvedThroughDownloadUrlProvider() throws Exception {
		given(mediaDownloadUrlProvider.issueDownloadUrl(anyString()))
			.willAnswer(invocation -> "https://signed.example/" + invocation.getArgument(0, String.class).substring(8));

		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.param("size", "1")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].media[0].fileUrl")
				.value("https://signed.example/cdn/image.jpg"))
			.andExpect(jsonPath("$.data.content[0].media[0].thumbnailUrl")
				.value("https://signed.example/cdn/thumb.jpg"));

		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("type", "IMAGE")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.dates[0].items[0].thumbnailUrl")
				.value("https://signed.example/cdn/thumb.jpg"));

		verify(mediaDownloadUrlProvider).issueDownloadUrl("https://cdn/image.jpg");
		verify(mediaDownloadUrlProvider, org.mockito.Mockito.times(2))
			.issueDownloadUrl("https://cdn/thumb.jpg");
	}

	@Test
	void viewerSpecificAliasIsUsedForAuthorDisplay() throws Exception {
		memberAliasRepository.save(new MemberAlias(group, viewer, author, "Mom"));
		entityManager.flush();

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.author.displayName").value("Mom"));
	}

	@Test
	void withdrawnAuthorIsDisplayedWithFallbackNameInListAndDetail() throws Exception {
		author.getUser().updateProfileImageUrl("https://cdn/profile-image/author.jpg");
		given(mediaDownloadUrlProvider.issueProfileImageDownloadUrl(
			"https://cdn/profile-image/author.jpg"))
			.willReturn("https://signed.example/author.jpg");
		author.leave(Instant.now());
		author.getUser().withdraw(Instant.now());
		entityManager.flush();

		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content.length()").value(2))
			.andExpect(jsonPath("$.data.content[0].author.displayName").value("탈퇴한 사용자"))
			.andExpect(jsonPath("$.data.content[0].author.profileImageUrl").doesNotExist());

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.author.displayName").value("탈퇴한 사용자"));
	}

	@Test
	void authorWhoOnlyLeftTheGroupKeepsRealName() throws Exception {
		author.leave(Instant.now());
		entityManager.flush();

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.author.displayName").value("Author"));
	}

	@Test
	void withdrawnAuthorIgnoresViewerAlias() throws Exception {
		memberAliasRepository.save(new MemberAlias(group, viewer, author, "Mom"));
		author.leave(Instant.now());
		author.getUser().withdraw(Instant.now());
		entityManager.flush();

		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.content[0].author.displayName").value("탈퇴한 사용자"));

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.author.displayName").value("탈퇴한 사용자"));
	}

	@Test
	void aliasIsKeptForAuthorWhoOnlyLeftTheGroup() throws Exception {
		memberAliasRepository.save(new MemberAlias(group, viewer, author, "Mom"));
		author.leave(Instant.now());
		entityManager.flush();

		mockMvc.perform(get("/posts/{postId}", imagePost.getId())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.author.displayName").value("Mom"));
	}

	@Test
	void archiveCanFilterByType() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("type", "IMAGE")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.dates[0].items.length()").value(1))
			.andExpect(jsonPath("$.data.dates[0].items[0].postId").value(imagePost.getId()))
			.andExpect(jsonPath("$.data.dates[0].items[0].type").value("IMAGE"))
			.andExpect(jsonPath("$.data.dates[0].items[0].thumbnailUrl").value("https://cdn/thumb.jpg"));

		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("type", "TEXT")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.dates[0].items[0].postId").value(textPost.getId()))
			.andExpect(jsonPath("$.data.dates[0].items[0].type").value("TEXT"));
	}

	@Test
	void archiveCanFilterByActiveMemberInTheSameGroup() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("memberId", author.getId().toString())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.dates[0].items.length()").value(2));

		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("memberId", viewer.getId().toString())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.dates").isEmpty());
	}

	@Test
	void archiveRejectsMemberFromAnotherGroup() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("memberId", otherGroupMember.getId().toString())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void archiveRejectsInactiveMember() throws Exception {
		author.leave(Instant.now());
		entityManager.flush();

		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("memberId", author.getId().toString())
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void invalidArchiveTypeIsRejected() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/archive", group.getId())
				.param("type", "AUDIO")
				.with(authenticatedAs(viewer.getUser().getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void nonMemberCannotReadPosts() throws Exception {
		User outsider = userRepository.save(user("read_out", "Outsider"));
		entityManager.flush();

		mockMvc.perform(get("/groups/{groupId}/posts", group.getId())
				.with(authenticatedAs(outsider.getId())))
			.andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedReadIsUnauthorized() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/posts", group.getId()))
			.andExpect(status().isUnauthorized());
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
