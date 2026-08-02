package com.ssafy.s15p11b104.domain.feed;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostReaction;
import com.ssafy.s15p11b104.domain.feed.entity.ReactionType;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
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
class ReactionApiTest extends IntegrationTest {

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
	private PostReactionRepository postReactionRepository;

	private FamilyGroup group;
	private GroupMember viewer;
	private GroupMember otherMember;
	private User outsider;
	private Post post;

	@BeforeEach
	void setUp() {
		postReactionRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User viewerUser = userRepository.save(user("rea_viewer", "Viewer"));
		User otherUser = userRepository.save(user("rea_other", "Other"));
		outsider = userRepository.save(user("rea_out", "Outsider"));
		group = entityManager.merge(new FamilyGroup("family", "REA001"));
		FamilyGroup otherGroup = entityManager.merge(new FamilyGroup("other", "REA002"));
		entityManager.flush();
		viewer = groupMemberRepository.save(
			new GroupMember(group, viewerUser, GroupRole.GUARDIAN, true, Instant.now()));
		otherMember = groupMemberRepository.save(
			new GroupMember(group, otherUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		groupMemberRepository.save(
			new GroupMember(otherGroup, outsider, GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();
		post = postRepository.save(new Post(group, otherMember, "reaction post"));
		entityManager.flush();
	}

	@Test
	void activeMemberCanCreateReplaceAndCancelReaction() throws Exception {
		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(ReactionType.HEART)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.postId").value(post.getId()))
			.andExpect(jsonPath("$.data.reactionType").value("HEART"))
			.andExpect(jsonPath("$.data.counts.HEART").value(1));

		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(ReactionType.LAUGH)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.reactionType").value("LAUGH"))
			.andExpect(jsonPath("$.data.counts.HEART").value(0))
			.andExpect(jsonPath("$.data.counts.LAUGH").value(1));

		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(ReactionType.LAUGH)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.reactionType").value(nullValue()))
			.andExpect(jsonPath("$.data.counts.LAUGH").value(0));

		org.assertj.core.api.Assertions.assertThat(
			postReactionRepository.findByPostIdAndGroupMemberId(post.getId(), viewer.getId())).isEmpty();
	}

	@Test
	void countsIncludeOtherMembersReactions() throws Exception {
		postReactionRepository.save(new PostReaction(post, otherMember, ReactionType.SUPPORT));
		entityManager.flush();

		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(ReactionType.SUPPORT)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.counts.SUPPORT").value(2));
	}

	@Test
	void nonMemberAndUnauthenticatedRequestsAreRejected() throws Exception {
		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(outsider.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(ReactionType.HEART)))
			.andExpect(status().isForbidden());

		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(ReactionType.HEART)))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void missingOrUnknownReactionTypeIsRejected() throws Exception {
		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(put("/posts/{postId}/reaction", post.getId())
				.with(authenticatedAs(viewer.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"reactionType\":\"UNKNOWN\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	private String json(ReactionType reactionType) throws Exception {
		return objectMapper.writeValueAsString(Map.of("reactionType", reactionType));
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
