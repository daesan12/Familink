package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.entity.EventParticipant;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 구성원 목록·프로필 조회와 관리자의 역할 변경·관리자 위임·내보내기를 검증한다.
 */
@AutoConfigureMockMvc
@Transactional
class GroupMemberApiTest extends IntegrationTest {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
	private static final long UNKNOWN_MEMBER_ID = 999_999L;

	@Autowired
	private MockMvc mockMvc;

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
	private User guardianUser;
	private User careReceiverUser;
	private User outsiderUser;
	private FamilyGroup group;
	private GroupMember managerMember;
	private GroupMember guardianMember;
	private GroupMember careReceiverMember;

	@BeforeEach
	void setUp() {
		entityManager.createNativeQuery("DELETE FROM event_participants").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM calendar_events").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_interests").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_aliases").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM posts").executeUpdate();
		groupJoinRequestRepository.deleteAll();
		groupMemberRepository.deleteAll();
		familyGroupRepository.deleteAll();
		userRepository.deleteAll();
		entityManager.flush();

		managerUser = userRepository.save(user("member_manager", "관리자"));
		guardianUser = userRepository.save(user("member_guardian", "보호자"));
		careReceiverUser = userRepository.save(user("member_receiver", "피보호자"));
		outsiderUser = userRepository.save(user("member_outsider", "외부인"));
		group = familyGroupRepository.save(new FamilyGroup("우리가족", "MBR123"));
		entityManager.flush();

		managerMember = groupMemberRepository.save(
			new GroupMember(group, managerUser, GroupRole.GUARDIAN, true, Instant.now()));
		guardianMember = groupMemberRepository.save(
			new GroupMember(group, guardianUser, GroupRole.GUARDIAN, false, Instant.now()));
		careReceiverMember = groupMemberRepository.save(
			new GroupMember(group, careReceiverUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		entityManager.flush();
		entityManager.clear();
	}

	@Test
	void membersReturnActiveMembersWithViewerAlias() throws Exception {
		persistAlias(managerMember, careReceiverMember, "엄마");

		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.members.length()").value(3))
			.andExpect(jsonPath("$.data.members[0].memberId").value(managerMember.getId()))
			.andExpect(jsonPath("$.data.members[0].userId").value(managerUser.getId()))
			.andExpect(jsonPath("$.data.members[0].displayName").value("관리자"))
			.andExpect(jsonPath("$.data.members[0].profileImageUrl").isEmpty())
			.andExpect(jsonPath("$.data.members[0].role").value("GUARDIAN"))
			.andExpect(jsonPath("$.data.members[0].isManager").value(true))
			.andExpect(jsonPath("$.data.members[1].memberId").value(guardianMember.getId()))
			.andExpect(jsonPath("$.data.members[1].isManager").value(false))
			.andExpect(jsonPath("$.data.members[2].memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.members[2].displayName").value("엄마"))
			.andExpect(jsonPath("$.data.members[2].role").value("CARE_RECEIVER"));
	}

	@Test
	void aliasIsVisibleOnlyToItsOwner() throws Exception {
		persistAlias(managerMember, careReceiverMember, "엄마");

		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.members[2].memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.members[2].displayName").value("피보호자"));
	}

	@Test
	void membersCanBeFilteredByRole() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.param("role", "GUARDIAN")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.members.length()").value(2))
			.andExpect(jsonPath("$.data.members[0].memberId").value(managerMember.getId()))
			.andExpect(jsonPath("$.data.members[1].memberId").value(guardianMember.getId()));

		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.param("role", "CARE_RECEIVER")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.members.length()").value(1))
			.andExpect(jsonPath("$.data.members[0].memberId").value(careReceiverMember.getId()));
	}

	@Test
	void unknownRoleFilterIsRejected() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.param("role", "NEIGHBOR")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void membersExcludeLeftMembers() throws Exception {
		leave(careReceiverMember.getId());

		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.members.length()").value(2))
			.andExpect(jsonPath("$.data.members[0].memberId").value(managerMember.getId()))
			.andExpect(jsonPath("$.data.members[1].memberId").value(guardianMember.getId()));
	}

	@Test
	void outsiderCannotReadMembers() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/members")
				.with(authenticatedAs(outsiderUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void memberProfileReturnsAliasAndGender() throws Exception {
		persistAlias(managerMember, careReceiverMember, "엄마");

		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.displayName").value("엄마"))
			.andExpect(jsonPath("$.data.gender").value("FEMALE"));

		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.displayName").value("피보호자"));
	}

	@Test
	void memberProfileReturnsKoreanAge() throws Exception {
		LocalDate today = LocalDate.now(BUSINESS_ZONE);
		updateBirthDate(careReceiverUser.getId(), today.minusYears(70));

		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.age").value(70));

		updateBirthDate(careReceiverUser.getId(), today.minusYears(70).plusDays(1));

		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.age").value(69));
	}

	@Test
	void outsiderCannotReadMemberProfile() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(outsiderUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("NOT_GROUP_MEMBER"));
	}

	@Test
	void unknownOrLeftMemberProfileIsNotFound() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + UNKNOWN_MEMBER_ID)
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));

		leave(careReceiverMember.getId());
		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));
	}

	@Test
	void managerCanChangeMemberRole() throws Exception {
		mockMvc.perform(changeRole(careReceiverMember.getId(), managerUser.getId(), "GUARDIAN"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.memberId").value(careReceiverMember.getId()))
			.andExpect(jsonPath("$.data.role").value("GUARDIAN"));

		entityManager.flush();
		entityManager.clear();
		assertThat(groupMemberRepository.findById(careReceiverMember.getId()).orElseThrow().getRole())
			.isEqualTo(GroupRole.GUARDIAN);
	}

	/**
	 * 같은 그룹의 기존 피보호자를 다시 피보호자로 지정해도 충돌로 보지 않는다. 활성 피보호자
	 * 판정에서 대상 자신을 제외하지 않으면 여기서 잘못된 409가 발생한다.
	 */
	@Test
	void reassigningExistingCareReceiverRoleIsAccepted() throws Exception {
		mockMvc.perform(changeRole(careReceiverMember.getId(), managerUser.getId(), "CARE_RECEIVER"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.role").value("CARE_RECEIVER"));
	}

	@Test
	void roleChangeIsRejectedWhenUserIsCareReceiverInAnotherGroup() throws Exception {
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집", "OTH123"));
		entityManager.flush();
		groupMemberRepository.save(new GroupMember(
			otherGroup,
			entityManager.find(User.class, guardianUser.getId()),
			GroupRole.CARE_RECEIVER,
			true,
			Instant.now()));
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(changeRole(guardianMember.getId(), managerUser.getId(), "CARE_RECEIVER"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP"));

		entityManager.clear();
		assertThat(groupMemberRepository.findById(guardianMember.getId()).orElseThrow().getRole())
			.isEqualTo(GroupRole.GUARDIAN);
	}

	@Test
	void nonManagerCannotChangeRole() throws Exception {
		mockMvc.perform(changeRole(careReceiverMember.getId(), guardianUser.getId(), "GUARDIAN"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(changeRole(careReceiverMember.getId(), outsiderUser.getId(), "GUARDIAN"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void roleChangeRejectsUnknownAndLeftMember() throws Exception {
		mockMvc.perform(changeRole(UNKNOWN_MEMBER_ID, managerUser.getId(), "GUARDIAN"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));

		leave(careReceiverMember.getId());
		mockMvc.perform(changeRole(careReceiverMember.getId(), managerUser.getId(), "GUARDIAN"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_ALREADY_LEFT"));
	}

	/**
	 * 다른 그룹의 구성원 ID를 넣어도 이 그룹의 작업으로 처리되지 않아야 한다. 조회에서
	 * {@code group.id} 조건이 빠지면 관리자가 남의 그룹 구성원을 조작할 수 있게 된다.
	 */
	@Test
	void memberIdFromAnotherGroupIsNotFound() throws Exception {
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집", "OTH123"));
		entityManager.flush();
		Long otherMemberId = groupMemberRepository.save(new GroupMember(
			otherGroup,
			entityManager.find(User.class, outsiderUser.getId()),
			GroupRole.GUARDIAN,
			true,
			Instant.now())).getId();
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + otherMemberId)
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));
		mockMvc.perform(changeRole(otherMemberId, managerUser.getId(), "CARE_RECEIVER"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));
		mockMvc.perform(changeManager(otherMemberId, managerUser.getId()))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));
		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + otherMemberId)
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));

		entityManager.clear();
		GroupMember untouched = groupMemberRepository.findById(otherMemberId).orElseThrow();
		assertThat(untouched.getRole()).isEqualTo(GroupRole.GUARDIAN);
		assertThat(untouched.isManager()).isTrue();
		assertThat(untouched.getLeftAt()).isNull();
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().isManager()).isTrue();
	}

	@Test
	void missingRequiredBodyFieldsAreRejected() throws Exception {
		mockMvc.perform(patch("/groups/" + group.getId() + "/members/" + careReceiverMember.getId() + "/role")
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		mockMvc.perform(patch("/groups/" + group.getId() + "/manager")
				.with(authenticatedAs(managerUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"newManagerMemberId\": null}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

		entityManager.clear();
		assertThat(groupMemberRepository.findById(careReceiverMember.getId()).orElseThrow().getRole())
			.isEqualTo(GroupRole.CARE_RECEIVER);
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().isManager()).isTrue();
	}

	@Test
	void managerTransferKeepsExactlyOneActiveManager() throws Exception {
		mockMvc.perform(changeManager(guardianMember.getId(), managerUser.getId()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.managerMemberId").value(guardianMember.getId()));

		entityManager.flush();
		entityManager.clear();
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().isManager()).isFalse();
		assertThat(groupMemberRepository.findById(guardianMember.getId()).orElseThrow().isManager()).isTrue();
		assertThat(groupMemberRepository.findAllActiveByGroupId(group.getId()))
			.filteredOn(GroupMember::isManager)
			.extracting(GroupMember::getId)
			.containsExactly(guardianMember.getId());
	}

	@Test
	void managerTransferToCareReceiverSucceeds() throws Exception {
		mockMvc.perform(changeManager(careReceiverMember.getId(), managerUser.getId()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.managerMemberId").value(careReceiverMember.getId()));

		entityManager.flush();
		entityManager.clear();
		GroupMember newManager = groupMemberRepository.findById(careReceiverMember.getId()).orElseThrow();
		assertThat(newManager.isManager()).isTrue();
		// 관리자 여부와 역할은 독립된 축이므로 위임이 역할을 승격시키지 않는다.
		assertThat(newManager.getRole()).isEqualTo(GroupRole.CARE_RECEIVER);
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().isManager()).isFalse();
	}

	@Test
	void managerTransferToSelfKeepsCurrentManager() throws Exception {
		mockMvc.perform(changeManager(managerMember.getId(), managerUser.getId()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.managerMemberId").value(managerMember.getId()));

		entityManager.flush();
		entityManager.clear();
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().isManager()).isTrue();
	}

	@Test
	void nonManagerCannotTransferManager() throws Exception {
		mockMvc.perform(changeManager(guardianMember.getId(), guardianUser.getId()))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(changeManager(guardianMember.getId(), outsiderUser.getId()))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void managerTransferRejectsUnknownAndLeftMember() throws Exception {
		mockMvc.perform(changeManager(UNKNOWN_MEMBER_ID, managerUser.getId()))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));

		leave(guardianMember.getId());
		mockMvc.perform(changeManager(guardianMember.getId(), managerUser.getId()))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_ALREADY_LEFT"));
	}

	/**
	 * 위임 API가 없으면 관리자는 {@code MANAGER_TRANSFER_REQUIRED} 때문에 그룹을 떠날 수 없다.
	 * 위임 후 탈퇴가 성공하는지 확인해 이 흐름이 실제로 열렸음을 검증한다.
	 */
	@Test
	void previousManagerCanLeaveAfterTransfer() throws Exception {
		mockMvc.perform(changeManager(guardianMember.getId(), managerUser.getId()))
			.andExpect(status().isOk());
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(delete("/groups/" + group.getId() + "/leave")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNoContent());

		entityManager.flush();
		entityManager.clear();
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().getLeftAt()).isNotNull();
	}

	@Test
	void managerCanRemoveMemberKeepingMembershipHistory() throws Exception {
		Long eventId = persistEventWithParticipants(careReceiverMember, guardianMember);

		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNoContent());

		entityManager.flush();
		entityManager.clear();
		GroupMember removed = groupMemberRepository.findById(careReceiverMember.getId()).orElseThrow();
		assertThat(removed.getLeftAt()).isNotNull();
		assertThat(removed.getRole()).isEqualTo(GroupRole.CARE_RECEIVER);
		assertThat(countMembershipRows(group.getId(), careReceiverUser.getId())).isEqualTo(1);
		assertThat(groupMemberRepository.findAllActiveByGroupId(group.getId()))
			.extracting(GroupMember::getId)
			.containsExactlyInAnyOrder(managerMember.getId(), guardianMember.getId());
		assertThat(entityManager.find(CalendarEvent.class, eventId)).isNotNull();
		assertThat(participantMemberIds(eventId)).containsExactly(guardianMember.getId());
	}

	private Long persistEventWithParticipants(GroupMember... participants) {
		FamilyGroup managedGroup = entityManager.find(FamilyGroup.class, group.getId());
		GroupMember creator = entityManager.find(GroupMember.class, managerMember.getId());
		CalendarEvent event = new CalendarEvent(
			managedGroup, creator, "가족 일정", null, LocalDate.now(), LocalDate.now(), null, null);
		event.changeParticipantScope(true);
		entityManager.persist(event);
		for (GroupMember participant : participants) {
			entityManager.persist(new EventParticipant(
				event, entityManager.find(GroupMember.class, participant.getId())));
		}
		entityManager.flush();
		entityManager.clear();
		return event.getId();
	}

	private List<Long> participantMemberIds(Long eventId) {
		return entityManager.createQuery("""
			select participant.groupMember.id
			from EventParticipant participant
			where participant.event.id = :eventId
			order by participant.groupMember.id
			""", Long.class)
			.setParameter("eventId", eventId)
			.getResultList();
	}

	@Test
	void managerCannotRemoveSelf() throws Exception {
		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + managerMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("CANNOT_REMOVE_SELF"));

		entityManager.clear();
		assertThat(groupMemberRepository.findById(managerMember.getId()).orElseThrow().getLeftAt()).isNull();
	}

	@Test
	void removeRejectsUnknownAndLeftMember() throws Exception {
		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + UNKNOWN_MEMBER_ID)
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_NOT_FOUND"));

		leave(careReceiverMember.getId());
		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("GROUP_MEMBER_ALREADY_LEFT"));
	}

	@Test
	void nonManagerCannotRemoveMember() throws Exception {
		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + careReceiverMember.getId())
				.with(authenticatedAs(outsiderUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void unauthenticatedRequestsAreRejected() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/members"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/groups/" + group.getId() + "/members/" + careReceiverMember.getId()))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(patch("/groups/" + group.getId() + "/members/" + careReceiverMember.getId() + "/role")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"role\": \"GUARDIAN\"}"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(patch("/groups/" + group.getId() + "/manager")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"newManagerMemberId\": " + guardianMember.getId() + "}"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/groups/" + group.getId() + "/members/" + careReceiverMember.getId()))
			.andExpect(status().isUnauthorized());
	}

	private RequestBuilder changeRole(
		Long memberId,
		Long authenticatedUserId,
		String role) {
		return patch("/groups/" + group.getId() + "/members/" + memberId + "/role")
			.with(authenticatedAs(authenticatedUserId))
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"role\": \"" + role + "\"}");
	}

	private RequestBuilder changeManager(
		Long newManagerMemberId,
		Long authenticatedUserId) {
		return patch("/groups/" + group.getId() + "/manager")
			.with(authenticatedAs(authenticatedUserId))
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"newManagerMemberId\": " + newManagerMemberId + "}");
	}

	private void persistAlias(GroupMember owner, GroupMember target, String alias) {
		entityManager.persist(new MemberAlias(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(GroupMember.class, owner.getId()),
			entityManager.find(GroupMember.class, target.getId()),
			alias));
		entityManager.flush();
		entityManager.clear();
	}

	private void updateBirthDate(Long userId, LocalDate birthDate) {
		entityManager.createQuery("""
			update User user
			set user.birthDate = :birthDate
			where user.id = :userId
			""")
			.setParameter("birthDate", birthDate)
			.setParameter("userId", userId)
			.executeUpdate();
		entityManager.clear();
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

	private long countMembershipRows(Long groupId, Long userId) {
		Number count = (Number)entityManager
			.createNativeQuery(
				"SELECT count(*) FROM group_members WHERE group_id = :groupId AND user_id = :userId")
			.setParameter("groupId", groupId)
			.setParameter("userId", userId)
			.getSingleResult();
		return count.longValue();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
