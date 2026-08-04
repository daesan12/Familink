package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@AutoConfigureMockMvc
@Transactional
class JoinRequestApiTest extends IntegrationTest {

	private static final String INVITE_CODE = "ABC123";

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

	@MockitoBean
	private MediaDownloadUrlProvider mediaDownloadUrlProvider;

	private User managerUser;
	private User memberUser;
	private User applicantUser;
	private FamilyGroup group;

	@BeforeEach
	void setUp() {
		groupJoinRequestRepository.deleteAll();
		groupMemberRepository.deleteAll();
		familyGroupRepository.deleteAll();
		userRepository.deleteAll();
		entityManager.flush();

		managerUser = userRepository.save(user("jr_manager", "관리자"));
		memberUser = userRepository.save(user("jr_member", "구성원"));
		applicantUser = userRepository.save(user("jr_applicant", "신청자"));
		group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
		entityManager.flush();

		groupMemberRepository.save(
			new GroupMember(group, managerUser, GroupRole.GUARDIAN, true, Instant.now()));
		groupMemberRepository.save(
			new GroupMember(group, memberUser, GroupRole.GUARDIAN, false, Instant.now()));
		entityManager.flush();
		entityManager.clear();
	}

	// --- API-GROUPS-007 초대 코드 조회 ---

	@Test
	void activeMemberCanReadInviteCode() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/invite-code")
				.with(authenticatedAs(memberUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.inviteCode").value(INVITE_CODE));
	}

	@Test
	void outsiderCannotReadInviteCode() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/invite-code")
				.with(authenticatedAs(applicantUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	// --- API-GROUPS-003 가입 요청 생성 ---

	@Test
	void inviteCodeCreatesPendingJoinRequest() throws Exception {
		MvcResult result = mockMvc.perform(post("/join-requests/by-code")
				.with(authenticatedAs(applicantUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"inviteCode\": \"abc123\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.groupId").value(group.getId()))
			.andExpect(jsonPath("$.data.groupName").value("우리가족"))
			.andExpect(jsonPath("$.data.status").value("PENDING_ADMIN"))
			.andExpect(jsonPath("$.data.joinRequestId").exists())
			.andReturn();

		long joinRequestId = objectMapper.readTree(result.getResponse().getContentAsString())
			.path("data").path("joinRequestId").asLong();
		entityManager.clear();

		GroupJoinRequest saved = groupJoinRequestRepository.findById(joinRequestId).orElseThrow();
		assertThat(saved.getStatus()).isEqualTo(JoinRequestStatus.PENDING_ADMIN);
		assertThat(saved.getAssignedRole()).isNull();
		assertThat(saved.getProcessedAt()).isNull();
		assertThat(groupMemberRepository.findActiveByGroupIdAndUserId(
			group.getId(), applicantUser.getId())).isEmpty();
	}

	@Test
	void unknownInviteCodeIsRejected() throws Exception {
		mockMvc.perform(post("/join-requests/by-code")
				.with(authenticatedAs(applicantUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"inviteCode\": \"ZZZ999\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVITE_CODE_INVALID"));

		assertThat(groupJoinRequestRepository.count()).isZero();
	}

	@Test
	void activeMemberCannotRequestToJoinAgain() throws Exception {
		mockMvc.perform(post("/join-requests/by-code")
				.with(authenticatedAs(memberUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"inviteCode\": \"" + INVITE_CODE + "\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ALREADY_GROUP_MEMBER"));

		assertThat(groupJoinRequestRepository.count()).isZero();
	}

	@Test
	void duplicatePendingRequestIsRejected() throws Exception {
		createPendingRequest(applicantUser);

		mockMvc.perform(post("/join-requests/by-code")
				.with(authenticatedAs(applicantUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"inviteCode\": \"" + INVITE_CODE + "\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("JOIN_REQUEST_ALREADY_EXISTS"));

		assertThat(groupJoinRequestRepository.count()).isEqualTo(1);
	}

	@Test
	void leftMemberCanRequestToJoinAgain() throws Exception {
		GroupMember leftMember = groupMemberRepository.save(new GroupMember(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(User.class, applicantUser.getId()),
			GroupRole.GUARDIAN,
			false,
			Instant.now()));
		entityManager.flush();
		leave(leftMember.getId());

		mockMvc.perform(post("/join-requests/by-code")
				.with(authenticatedAs(applicantUser.getId()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"inviteCode\": \"" + INVITE_CODE + "\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.status").value("PENDING_ADMIN"));
	}

	// --- API-GROUPS-008 가입 요청 목록 ---

	@Test
	void managerCanListJoinRequestsWithApplicantProfile() throws Exception {
		applicantUser.updateProfileImageUrl("https://cdn/profile-image/applicant.jpg");
		applicantUser = userRepository.saveAndFlush(applicantUser);
		given(mediaDownloadUrlProvider.issueProfileImageDownloadUrl(
			"https://cdn/profile-image/applicant.jpg"))
			.willReturn("https://signed.example/applicant.jpg");
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(get("/groups/" + group.getId() + "/join-requests")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.joinRequests.length()").value(1))
			.andExpect(jsonPath("$.data.joinRequests[0].joinRequestId").value(pending.getId()))
			.andExpect(jsonPath("$.data.joinRequests[0].applicantUserId").value(applicantUser.getId()))
			.andExpect(jsonPath("$.data.joinRequests[0].applicantName").value("신청자"))
			.andExpect(jsonPath("$.data.joinRequests[0].profileImageUrl")
				.value("https://signed.example/applicant.jpg"))
			.andExpect(jsonPath("$.data.joinRequests[0].status").value("PENDING_ADMIN"))
			.andExpect(jsonPath("$.data.joinRequests[0].createdAt").exists())
			.andExpect(jsonPath("$.data.joinRequests[0].assignedRole").doesNotExist())
			.andExpect(jsonPath("$.data.joinRequests[0].processedAt").doesNotExist());

		verify(mediaDownloadUrlProvider).issueProfileImageDownloadUrl(
			"https://cdn/profile-image/applicant.jpg");
		assertThat(userRepository.findById(applicantUser.getId()).orElseThrow().getProfileImageUrl())
			.isEqualTo("https://cdn/profile-image/applicant.jpg");
	}

	@Test
	void joinRequestListCanBeFilteredByStatus() throws Exception {
		createPendingRequest(applicantUser);
		GroupJoinRequest rejected = createPendingRequest(memberUser);
		rejected.reject(Instant.now());
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(get("/groups/" + group.getId() + "/join-requests")
				.param("status", "PENDING_ADMIN")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.joinRequests.length()").value(1))
			.andExpect(jsonPath("$.data.joinRequests[0].status").value("PENDING_ADMIN"));

		mockMvc.perform(get("/groups/" + group.getId() + "/join-requests")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.joinRequests.length()").value(2));
	}

	@Test
	void unknownStatusFilterIsRejected() throws Exception {
		createPendingRequest(applicantUser);

		mockMvc.perform(get("/groups/" + group.getId() + "/join-requests")
				.param("status", "UNKNOWN")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void withdrawnApplicantRequestIsHiddenAndNotDecidable() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);
		entityManager.find(User.class, applicantUser.getId()).withdraw(Instant.now());
		flushAndClear();

		mockMvc.perform(get("/groups/" + group.getId() + "/join-requests")
				.with(authenticatedAs(managerUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.joinRequests.length()").value(0));

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("JOIN_REQUEST_NOT_FOUND"));

		entityManager.clear();
		assertThat(countMembershipRows(group.getId(), applicantUser.getId())).isZero();
	}

	@Test
	void nonManagerCannotListJoinRequests() throws Exception {
		createPendingRequest(applicantUser);

		for (Long userId : List.of(memberUser.getId(), applicantUser.getId())) {
			mockMvc.perform(get("/groups/" + group.getId() + "/join-requests")
					.with(authenticatedAs(userId)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("NOT_GROUP_MANAGER"));
		}
	}

	// --- API-GROUPS-009 승인·거절 ---

	@Test
	void approvalCreatesMembershipWithAssignedRole() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"CARE_RECEIVER\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.joinRequestId").value(pending.getId()))
			.andExpect(jsonPath("$.data.status").value("APPROVED"))
			.andExpect(jsonPath("$.data.assignedRole").value("CARE_RECEIVER"))
			.andExpect(jsonPath("$.data.memberId").exists());

		flushAndClear();
		GroupMember created = groupMemberRepository
			.findActiveByGroupIdAndUserId(group.getId(), applicantUser.getId())
			.orElseThrow();
		assertThat(created.getRole()).isEqualTo(GroupRole.CARE_RECEIVER);
		assertThat(created.isManager()).isFalse();

		GroupJoinRequest processed = groupJoinRequestRepository.findById(pending.getId()).orElseThrow();
		assertThat(processed.getStatus()).isEqualTo(JoinRequestStatus.APPROVED);
		assertThat(processed.getAssignedRole()).isEqualTo(GroupRole.CARE_RECEIVER);
		assertThat(processed.getProcessedAt()).isNotNull();
	}

	@Test
	void approvalReactivatesExistingMembershipWithoutDuplicateRow() throws Exception {
		GroupMember leftMember = groupMemberRepository.save(new GroupMember(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(User.class, applicantUser.getId()),
			GroupRole.CARE_RECEIVER,
			false,
			Instant.now()));
		entityManager.flush();
		leave(leftMember.getId());
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.memberId").value(leftMember.getId()))
			.andExpect(jsonPath("$.data.assignedRole").value("GUARDIAN"));

		flushAndClear();
		assertThat(countMembershipRows(group.getId(), applicantUser.getId())).isEqualTo(1);
		GroupMember reactivated = groupMemberRepository.findById(leftMember.getId()).orElseThrow();
		assertThat(reactivated.getLeftAt()).isNull();
		assertThat(reactivated.getRole()).isEqualTo(GroupRole.GUARDIAN);
	}

	@Test
	void approvingAnAlreadyActiveMemberIsRejected() throws Exception {
		GroupJoinRequest pending = createPendingRequest(memberUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"CARE_RECEIVER\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("ALREADY_GROUP_MEMBER"));

		entityManager.clear();
		assertThat(countMembershipRows(group.getId(), memberUser.getId())).isEqualTo(1);
		assertThat(groupMemberRepository
			.findActiveByGroupIdAndUserId(group.getId(), memberUser.getId())
			.orElseThrow()
			.getRole()).isEqualTo(GroupRole.GUARDIAN);
	}

	@Test
	void rejoinClearsManagerFlag() throws Exception {
		GroupMember formerManager = groupMemberRepository.save(new GroupMember(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(User.class, applicantUser.getId()),
			GroupRole.GUARDIAN,
			false,
			Instant.now()));
		entityManager.flush();
		markLeftManager(formerManager.getId());
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.memberId").value(formerManager.getId()));

		flushAndClear();
		GroupMember reactivated = groupMemberRepository.findById(formerManager.getId()).orElseThrow();
		assertThat(reactivated.isManager()).isFalse();
		assertThat(reactivated.getLeftAt()).isNull();
	}

	@Test
	void rejectionLeavesMembershipAndAssignedRoleUnchanged() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"REJECT\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.status").value("REJECTED"))
			.andExpect(jsonPath("$.data.memberId").doesNotExist())
			.andExpect(jsonPath("$.data.assignedRole").doesNotExist());

		flushAndClear();
		GroupJoinRequest processed = groupJoinRequestRepository.findById(pending.getId()).orElseThrow();
		assertThat(processed.getStatus()).isEqualTo(JoinRequestStatus.REJECTED);
		assertThat(processed.getAssignedRole()).isNull();
		assertThat(processed.getProcessedAt()).isNotNull();
		assertThat(countMembershipRows(group.getId(), applicantUser.getId())).isZero();
	}

	@Test
	void approvalWithoutAssignedRoleIsRejected() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("ASSIGNED_ROLE_REQUIRED"));

		entityManager.clear();
		assertThat(groupJoinRequestRepository.findById(pending.getId()).orElseThrow().getStatus())
			.isEqualTo(JoinRequestStatus.PENDING_ADMIN);
	}

	@Test
	void invalidDecisionValueIsRejected() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		for (String body : List.of("{\"decision\": \"MAYBE\"}", "{\"decision\": null}", "{}")) {
			mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(), body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_JOIN_REQUEST_DECISION"));
		}

		entityManager.clear();
		assertThat(groupJoinRequestRepository.findById(pending.getId()).orElseThrow().getStatus())
			.isEqualTo(JoinRequestStatus.PENDING_ADMIN);
	}

	@Test
	void alreadyProcessedRequestCannotBeDecidedAgain() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);
		pending.reject(Instant.now());
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("JOIN_REQUEST_ALREADY_PROCESSED"));
	}

	@Test
	void missingJoinRequestReturnsNotFound() throws Exception {
		mockMvc.perform(decisionRequest(999999L, managerUser.getId(),
				"{\"decision\": \"REJECT\"}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("JOIN_REQUEST_NOT_FOUND"));
	}

	@Test
	void joinRequestOfAnotherGroupIsNotVisibleThroughThisGroup() throws Exception {
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집", "XYZ789"));
		entityManager.flush();
		groupMemberRepository.save(new GroupMember(
			otherGroup, entityManager.find(User.class, managerUser.getId()),
			GroupRole.GUARDIAN, true, Instant.now()));
		GroupJoinRequest otherRequest = groupJoinRequestRepository.save(new GroupJoinRequest(
			otherGroup, entityManager.find(User.class, applicantUser.getId()),
			JoinRequestStatus.PENDING_ADMIN));
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(decisionRequest(otherRequest.getId(), managerUser.getId(),
				"{\"decision\": \"REJECT\"}"))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("JOIN_REQUEST_NOT_FOUND"));
	}

	@Test
	void nonManagerCannotDecide() throws Exception {
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		for (Long userId : List.of(memberUser.getId(), applicantUser.getId())) {
			mockMvc.perform(decisionRequest(pending.getId(), userId,
					"{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("NOT_GROUP_MANAGER"));
		}

		entityManager.clear();
		assertThat(groupJoinRequestRepository.findById(pending.getId()).orElseThrow().getStatus())
			.isEqualTo(JoinRequestStatus.PENDING_ADMIN);
	}

	@Test
	void careReceiverActiveInAnotherGroupCannotBeApprovedAsCareReceiver() throws Exception {
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집", "XYZ789"));
		entityManager.flush();
		groupMemberRepository.save(new GroupMember(
			otherGroup, entityManager.find(User.class, applicantUser.getId()),
			GroupRole.CARE_RECEIVER, true, Instant.now()));
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"CARE_RECEIVER\"}"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP"));

		entityManager.clear();
		assertThat(groupJoinRequestRepository.findById(pending.getId()).orElseThrow().getStatus())
			.isEqualTo(JoinRequestStatus.PENDING_ADMIN);
		assertThat(countMembershipRows(group.getId(), applicantUser.getId())).isZero();
	}

	@Test
	void careReceiverInAnotherGroupCanStillBeApprovedAsGuardian() throws Exception {
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집", "XYZ789"));
		entityManager.flush();
		groupMemberRepository.save(new GroupMember(
			otherGroup, entityManager.find(User.class, applicantUser.getId()),
			GroupRole.CARE_RECEIVER, true, Instant.now()));
		GroupJoinRequest pending = createPendingRequest(applicantUser);

		mockMvc.perform(decisionRequest(pending.getId(), managerUser.getId(),
				"{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.assignedRole").value("GUARDIAN"));
	}

	@Test
	void unauthenticatedRequestsAreRejected() throws Exception {
		mockMvc.perform(get("/groups/" + group.getId() + "/invite-code"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/groups/" + group.getId() + "/join-requests"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/join-requests/by-code")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"inviteCode\": \"" + INVITE_CODE + "\"}"))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(patch("/groups/" + group.getId() + "/join-requests/1")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"decision\": \"REJECT\"}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void missingInviteCodeIsRejectedWithContractCode() throws Exception {
		for (String body : List.of("{}", "{\"inviteCode\": null}", "{\"inviteCode\": \"   \"}")) {
			mockMvc.perform(post("/join-requests/by-code")
					.with(authenticatedAs(applicantUser.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVITE_CODE_INVALID"));
		}

		assertThat(groupJoinRequestRepository.count()).isZero();
	}

	private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder decisionRequest(
		Long joinRequestId, Long userId, String body) {
		return patch("/groups/" + group.getId() + "/join-requests/" + joinRequestId)
			.with(authenticatedAs(userId))
			.contentType(MediaType.APPLICATION_JSON)
			.content(body);
	}

	private GroupJoinRequest createPendingRequest(User applicant) {
		GroupJoinRequest saved = groupJoinRequestRepository.save(new GroupJoinRequest(
			entityManager.find(FamilyGroup.class, group.getId()),
			entityManager.find(User.class, applicant.getId()),
			JoinRequestStatus.PENDING_ADMIN));
		entityManager.flush();
		return saved;
	}

	/**
	 * 테스트가 서비스와 같은 트랜잭션을 공유하므로, 서비스가 dirty checking으로 바꾼 값을 DB에서 다시
	 * 읽기 전에 flush한다. flush 없이 clear하면 아직 반영되지 않은 변경이 detach되면서 사라진다.
	 */
	private void flushAndClear() {
		entityManager.flush();
		entityManager.clear();
	}

	private long countMembershipRows(Long groupId, Long userId) {
		Number count = (Number) entityManager.createNativeQuery(
				"SELECT count(*) FROM group_members WHERE group_id = :groupId AND user_id = :userId")
			.setParameter("groupId", groupId)
			.setParameter("userId", userId)
			.getSingleResult();
		return count.longValue();
	}

	/**
	 * 관리자였던 구성원이 그룹을 떠난 상태를 만든다. `uq_group_active_manager`가 활성 관리자만
	 * 제약하므로 비활성 행에는 `is_manager = TRUE`가 남을 수 있다.
	 */
	private void markLeftManager(Long memberId) {
		entityManager.createNativeQuery(
				"UPDATE group_members SET is_manager = TRUE, left_at = CURRENT_TIMESTAMP WHERE id = :memberId")
			.setParameter("memberId", memberId)
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

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
