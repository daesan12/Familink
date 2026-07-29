package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.entity.MemberInterest;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class GroupApiTest extends IntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private GroupJoinRequestRepository groupJoinRequestRepository;

	private User managerUser;
	private User memberUser;
	private User outsiderUser;
	private FamilyGroup group;
	private GroupMember managerMember;
	private GroupMember careReceiverMember;

	@BeforeEach
	void setUp() {
		entityManager.createNativeQuery("DELETE FROM member_interests").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_aliases").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM posts").executeUpdate();
		groupJoinRequestRepository.deleteAll();
		groupMemberRepository.deleteAll();
		familyGroupRepository.deleteAll();
		userRepository.deleteAll();
		entityManager.flush();

		managerUser = userRepository.save(user("group_manager", "관리자"));
		memberUser = userRepository.save(user("group_member", "구성원"));
		outsiderUser = userRepository.save(user("group_outsider", "외부인"));
		group = familyGroupRepository.save(new FamilyGroup("우리가족", "ABC123"));
		entityManager.flush();

		managerMember = groupMemberRepository.save(
			new GroupMember(group, managerUser, GroupRole.GUARDIAN, true, Instant.now()));
		careReceiverMember = groupMemberRepository.save(
			new GroupMember(group, memberUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		entityManager.flush();
		entityManager.clear();
	}

	@Test
	void myGroupsReturnActiveMembershipsWithMemberCount() throws Exception {
		mockMvc.perform(get("/groups").with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.groups.length()").value(1))
			.andExpect(jsonPath("$.data.groups[0].id").value(group.getId()))
			.andExpect(jsonPath("$.data.groups[0].name").value("우리가족"))
			.andExpect(jsonPath("$.data.groups[0].myMemberId").value(managerMember.getId()))
			.andExpect(jsonPath("$.data.groups[0].myRole").value("GUARDIAN"))
			.andExpect(jsonPath("$.data.groups[0].memberCount").value(2))
			.andExpect(jsonPath("$.data.groups[0].isManager").value(true))
			.andExpect(jsonPath("$.data.joinRequests.length()").value(0));
	}

	@Test
	void myGroupsIncludeOwnJoinRequests() throws Exception {
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집", "XYZ789"));
		entityManager.flush();
		GroupJoinRequest request = groupJoinRequestRepository.save(new GroupJoinRequest(
			otherGroup,
			entityManager.find(User.class, outsiderUser.getId()),
			JoinRequestStatus.PENDING_ADMIN));
		entityManager.flush();

		mockMvc.perform(get("/groups").with(authenticatedAs(outsiderUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.groups.length()").value(0))
			.andExpect(jsonPath("$.data.joinRequests.length()").value(1))
			.andExpect(jsonPath("$.data.joinRequests[0].joinRequestId").value(request.getId()))
			.andExpect(jsonPath("$.data.joinRequests[0].groupId").value(otherGroup.getId()))
			.andExpect(jsonPath("$.data.joinRequests[0].groupName").value("옆집"))
			.andExpect(jsonPath("$.data.joinRequests[0].status").value("PENDING_ADMIN"))
			.andExpect(jsonPath("$.data.joinRequests[0].requestedAt").exists())
			.andExpect(jsonPath("$.data.joinRequests[0].processedAt").doesNotExist());
	}

	@Test
	void myGroupsExcludeLeftMemberships() throws Exception {
		leave(careReceiverMember.getId());

		mockMvc.perform(get("/groups").with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.groups.length()").value(0));
	}

	@Test
	void creatingGroupMakesCreatorTheManager() throws Exception {
		MvcResult result = mockMvc.perform(post("/groups")
				.with(authenticatedAs(outsiderUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \" 새가족 \", \"myRole\": \"GUARDIAN\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.groupId").exists())
			.andExpect(jsonPath("$.data.managerMemberId").exists())
			.andExpect(jsonPath("$.data.inviteCode").exists())
			.andExpect(jsonPath("$.data.createdAt").exists())
			.andReturn();

		long createdGroupId = objectMapper.readTree(result.getResponse().getContentAsString())
			.path("data").path("groupId").asLong();
		String inviteCode = objectMapper.readTree(result.getResponse().getContentAsString())
			.path("data").path("inviteCode").asText();
		entityManager.clear();

		FamilyGroup created = familyGroupRepository.findById(createdGroupId).orElseThrow();
		assertThat(created.getName()).isEqualTo("새가족");
		assertThat(created.getInviteCode()).hasSize(6).isEqualTo(inviteCode);

		GroupMember creatorMember = groupMemberRepository
			.findActiveByGroupIdAndUserId(createdGroupId, outsiderUser.getId())
			.orElseThrow();
		assertThat(creatorMember.isManager()).isTrue();
		assertThat(creatorMember.getRole()).isEqualTo(GroupRole.GUARDIAN);
	}

	@Test
	void careReceiverCannotCreateASecondActiveGroup() throws Exception {
		mockMvc.perform(post("/groups")
				.with(authenticatedAs(memberUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"두번째\", \"myRole\": \"CARE_RECEIVER\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		assertThat(familyGroupRepository.count()).isEqualTo(1);
	}

	@Test
	void invalidGroupCreationRequestIsRejected() throws Exception {
		List<String> invalidBodies = List.of(
			"{\"name\": \"\", \"myRole\": \"GUARDIAN\"}",
			"{\"name\": \"   \", \"myRole\": \"GUARDIAN\"}",
			"{\"name\": \"12345678901\", \"myRole\": \"GUARDIAN\"}",
			"{\"name\": null, \"myRole\": \"GUARDIAN\"}",
			"{\"name\": \"가족\", \"myRole\": null}",
			"{\"name\": \"가족\", \"myRole\": \"UNKNOWN\"}");
		for (String body : invalidBodies) {
			mockMvc.perform(post("/groups")
					.with(authenticatedAs(outsiderUser.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}

		assertThat(familyGroupRepository.count()).isEqualTo(1);
	}

	@Test
	void activeMemberCanReadGroupDetail() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId()).with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(group.getId()))
			.andExpect(jsonPath("$.data.name").value("우리가족"))
			.andExpect(jsonPath("$.data.managerMemberId").value(managerMember.getId()))
			.andExpect(jsonPath("$.data.isManager").value(false))
			.andExpect(jsonPath("$.data.guardianCount").value(1))
			.andExpect(jsonPath("$.data.careReceiverCount").value(1))
			.andExpect(jsonPath("$.data.memberCount").value(2));
	}

	@Test
	void outsiderCannotReadGroupDetail() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId()).with(authenticatedAs(outsiderUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void leftMemberCannotReadGroupDetail() throws Exception {
		leave(careReceiverMember.getId());

		mockMvc.perform(get("/groups/" + group.getId()).with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void managerCanRenameGroup() throws Exception {
		mockMvc.perform(patch("/groups/" + group.getId())
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \" 새이름 \"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.id").value(group.getId()))
			.andExpect(jsonPath("$.data.name").value("새이름"))
			.andExpect(jsonPath("$.data.updatedAt").exists());

		entityManager.clear();
		assertThat(familyGroupRepository.findById(group.getId()).orElseThrow().getName())
			.isEqualTo("새이름");
	}

	@Test
	void nonManagerCannotRenameGroup() throws Exception {
		mockMvc.perform(patch("/groups/" + group.getId())
				.with(authenticatedAs(memberUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"새이름\"}"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		entityManager.clear();
		assertThat(familyGroupRepository.findById(group.getId()).orElseThrow().getName())
			.isEqualTo("우리가족");
	}

	@Test
	void invalidGroupNameUpdateIsRejected() throws Exception {
		for (String body : List.of("{\"name\": \"   \"}", "{\"name\": \"12345678901\"}", "{\"name\": null}")) {
			mockMvc.perform(patch("/groups/" + group.getId())
					.with(authenticatedAs(managerUser.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
		}

		entityManager.clear();
		assertThat(familyGroupRepository.findById(group.getId()).orElseThrow().getName())
			.isEqualTo("우리가족");
	}

	@Test
	void managerAloneCanDeleteGroupWithItsDataOnly() throws Exception {
		FamilyGroup survivingGroup = familyGroupRepository.save(new FamilyGroup("남는가족", "SUR123"));
		entityManager.flush();
		GroupMember survivingManager = groupMemberRepository.save(
			new GroupMember(survivingGroup, outsiderUser, GroupRole.GUARDIAN, true, Instant.now()));
		GroupMember survivingTarget = groupMemberRepository.save(
			new GroupMember(survivingGroup, memberUser, GroupRole.GUARDIAN, false, Instant.now()));
		entityManager.persist(new MemberAlias(survivingGroup, survivingManager, survivingTarget, "이웃"));
		entityManager.persist(new Post(survivingGroup, survivingManager, "남는 게시글"));
		entityManager.flush();

		entityManager.persist(new MemberAlias(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(GroupMember.class, managerMember.getId()),
			entityManager.find(GroupMember.class, careReceiverMember.getId()),
			"엄마"));
		entityManager.persist(new MemberInterest(
			entityManager.find(GroupMember.class, careReceiverMember.getId()), "등산"));
		entityManager.persist(new Post(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(GroupMember.class, managerMember.getId()),
			"삭제될 게시글"));
		groupJoinRequestRepository.save(new GroupJoinRequest(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(User.class, outsiderUser.getId()),
			JoinRequestStatus.PENDING_ADMIN));
		entityManager.flush();
		leave(careReceiverMember.getId());

		mockMvc.perform(delete("/groups/" + group.getId())
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"confirmationName\": \"우리가족\"}"))
			.andExpect(status().isNoContent());

		assertThat(familyGroupRepository.existsById(group.getId())).isFalse();
		assertThat(groupMemberRepository.findAllActiveByGroupId(group.getId())).isEmpty();
		assertThat(countByGroup("group_members", group.getId())).isZero();
		assertThat(countByGroup("group_join_requests", group.getId())).isZero();
		assertThat(countByGroup("member_aliases", group.getId())).isZero();
		assertThat(countByGroup("posts", group.getId())).isZero();
		assertThat(countRemainingInterests()).isZero();

		assertThat(familyGroupRepository.existsById(survivingGroup.getId())).isTrue();
		assertThat(countByGroup("group_members", survivingGroup.getId())).isEqualTo(2);
		assertThat(countByGroup("member_aliases", survivingGroup.getId())).isEqualTo(1);
		assertThat(countByGroup("posts", survivingGroup.getId())).isEqualTo(1);
		assertThat(userRepository.count()).isEqualTo(3);
	}

	@Test
	void groupWithOtherActiveMembersCannotBeDeleted() throws Exception {
		mockMvc.perform(delete("/groups/" + group.getId())
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"confirmationName\": \"우리가족\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("GROUP_HAS_ACTIVE_MEMBERS"));

		assertThat(familyGroupRepository.existsById(group.getId())).isTrue();
	}

	@Test
	void deleteIsRejectedWhenConfirmationNameDiffers() throws Exception {
		leave(careReceiverMember.getId());

		mockMvc.perform(delete("/groups/" + group.getId())
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"confirmationName\": \"다른이름\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("GROUP_NAME_MISMATCH"));

		assertThat(familyGroupRepository.existsById(group.getId())).isTrue();
	}

	@Test
	void outsiderCannotUpdateOrDeleteGroup() throws Exception {
		mockMvc.perform(patch("/groups/" + group.getId())
				.with(authenticatedAs(outsiderUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"침입\"}"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(delete("/groups/" + group.getId())
				.with(authenticatedAs(outsiderUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"confirmationName\": \"우리가족\"}"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		entityManager.clear();
		assertThat(familyGroupRepository.findById(group.getId()).orElseThrow().getName())
			.isEqualTo("우리가족");
	}

	@Test
	void nonManagerCannotDeleteGroup() throws Exception {
		mockMvc.perform(delete("/groups/" + group.getId())
				.with(authenticatedAs(memberUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"confirmationName\": \"우리가족\"}"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		assertThat(familyGroupRepository.existsById(group.getId())).isTrue();
	}

	@Test
	void unauthenticatedRequestsAreRejected() throws Exception {
		mockMvc.perform(get("/groups")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/groups/" + group.getId())).andExpect(status().isUnauthorized());
		mockMvc.perform(post("/groups")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\": \"가족\", \"myRole\": \"GUARDIAN\"}"))
			.andExpect(status().isUnauthorized());
	}

	private long countByGroup(String table, Long groupId) {
		Number count = (Number) entityManager
			.createNativeQuery("SELECT count(*) FROM " + table + " WHERE group_id = :groupId")
			.setParameter("groupId", groupId)
			.getSingleResult();
		return count.longValue();
	}

	private long countRemainingInterests() {
		Number count = (Number) entityManager
			.createNativeQuery("SELECT count(*) FROM member_interests")
			.getSingleResult();
		return count.longValue();
	}

	private void leave(Long memberId) {
		entityManager.createQuery("""
			update GroupMember member
			set member.leftAt = :leftAt
			where member.id = :memberId
			""")
			.setParameter("leftAt", Instant.now())
			.setParameter("memberId", memberId)
			.executeUpdate();
		entityManager.clear();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
