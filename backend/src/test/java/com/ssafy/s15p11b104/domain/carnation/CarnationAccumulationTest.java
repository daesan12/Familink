package com.ssafy.s15p11b104.domain.carnation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.ssafy.s15p11b104.domain.carnation.entity.Carnation;
import com.ssafy.s15p11b104.domain.carnation.repository.CarnationRepository;
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
class CarnationAccumulationTest extends IntegrationTest {

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
	private CarnationRepository carnationRepository;

	private FamilyGroup group;
	private GroupMember guardianMember;
	private GroupMember careReceiverMember;

	@BeforeEach
	void setUp() {
		carnationRepository.deleteAll();
		postMediaRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();

		User guardian = userRepository.save(user("carn_guardian", "보호자"));
		User careReceiver = userRepository.save(user("carn_receiver", "피보호자"));
		group = entityManager.merge(new FamilyGroup("family", "CAR123"));
		entityManager.flush();
		guardianMember = groupMemberRepository.save(
			new GroupMember(group, guardian, GroupRole.GUARDIAN, true, Instant.now()));
		careReceiverMember = groupMemberRepository.save(
			new GroupMember(group, careReceiver, GroupRole.CARE_RECEIVER, false, Instant.now()));
		entityManager.flush();
	}

	@Test
	void guardianGetsOneCarnationPerKstDateAndDeleteDoesNotRemoveIt() throws Exception {
		createPost(guardianMember.getUser().getId(), "첫 글");
		Long firstPostId = postRepository.findAll().get(0).getId();
		createPost(guardianMember.getUser().getId(), "두 번째 글");

		assertThat(carnationRepository.findAll())
			.hasSize(1)
			.first()
			.satisfies(carnation -> {
				assertThat(carnation.getGroupMember().getId()).isEqualTo(guardianMember.getId());
				assertThat(carnation.getEarnedDate()).isEqualTo(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")));
			});

		mockMvc.perform(delete("/posts/{postId}", firstPostId)
				.with(authenticatedAs(guardianMember.getUser().getId())))
			.andExpect(status().isNoContent());

		assertThat(carnationRepository.count()).isEqualTo(1);
	}

	@Test
	void careReceiverPostDoesNotEarnCarnation() throws Exception {
		createPost(careReceiverMember.getUser().getId(), "피보호자 글");

		assertThat(carnationRepository.count()).isZero();
	}

	@Test
	void sameGuardianEarnsSeparatelyForEachGroup() throws Exception {
		FamilyGroup otherGroup = entityManager.merge(new FamilyGroup("other", "CAR456"));
		entityManager.flush();
		GroupMember otherGuardian = groupMemberRepository.save(
			new GroupMember(otherGroup, guardianMember.getUser(), GroupRole.GUARDIAN, true, Instant.now()));
		entityManager.flush();

		Map<String, Object> body = Map.of(
			"groupIds", List.of(group.getId(), otherGroup.getId()),
			"content", "두 그룹 글",
			"media", List.of());
		mockMvc.perform(post("/posts")
				.with(authenticatedAs(guardianMember.getUser().getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)))
			.andExpect(status().isCreated());

		assertThat(carnationRepository.findAll())
			.extracting(carnation -> carnation.getGroup().getId())
			.containsExactlyInAnyOrder(group.getId(), otherGroup.getId());
		assertThat(otherGuardian.getId()).isNotEqualTo(guardianMember.getId());
	}

	private void createPost(Long userId, String content) throws Exception {
		mockMvc.perform(post("/posts")
				.with(authenticatedAs(userId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
					"groupIds", List.of(group.getId()),
					"content", content,
					"media", List.of()))))
			.andExpect(status().isCreated());
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1995, 3, 17), UserGender.MALE);
	}
}
