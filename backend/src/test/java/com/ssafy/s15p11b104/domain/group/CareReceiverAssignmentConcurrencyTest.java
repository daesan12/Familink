package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
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

/**
 * 서로 다른 두 그룹이 같은 사용자를 동시에 피보호자로 지정할 때의 응답 계약을 검증한다.
 *
 * <p>활성 피보호자 제약은 그룹을 가로지르므로 그룹별 멤버십 행을 잠그는 것만으로는 두 요청이
 * 직렬화되지 않는다. 대상 계정 행을 먼저 잠그지 않으면 양쪽 사전 검사가 모두 통과한 뒤
 * {@code uq_user_active_care_receiver}에서 한쪽이 실패하고, 그 위반이 계약에 없는 500이 된다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class CareReceiverAssignmentConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String FIRST_INVITE_CODE = "CRA001";
	private static final String SECOND_INVITE_CODE = "CRA002";
	private static final List<String> INVITE_CODES = List.of(FIRST_INVITE_CODE, SECOND_INVITE_CODE);
	private static final String FIRST_MANAGER_LOGIN_ID = "cra_manager_1";
	private static final String SECOND_MANAGER_LOGIN_ID = "cra_manager_2";
	private static final String TARGET_LOGIN_ID = "cra_target";
	private static final List<String> LOGIN_IDS =
		List.of(FIRST_MANAGER_LOGIN_ID, SECOND_MANAGER_LOGIN_ID, TARGET_LOGIN_ID);
	private static final String CONFLICT_CODE = "CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP";
	private static final String ROLE_BODY = "{\"role\": \"CARE_RECEIVER\"}";
	private static final String APPROVE_BODY = "{\"decision\": \"APPROVE\", \"assignedRole\": \"CARE_RECEIVER\"}";
	private static final String CREATE_GROUP_BODY = "{\"name\": \"새집\", \"myRole\": \"CARE_RECEIVER\"}";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TransactionTemplate transactionTemplate;

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

	private Long firstGroupId;
	private Long secondGroupId;
	private Long firstManagerUserId;
	private Long secondManagerUserId;
	private Long targetUserId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User firstManager = userRepository.save(user(FIRST_MANAGER_LOGIN_ID, "관리자1"));
			User secondManager = userRepository.save(user(SECOND_MANAGER_LOGIN_ID, "관리자2"));
			User target = userRepository.save(user(TARGET_LOGIN_ID, "대상자"));
			FamilyGroup firstGroup = familyGroupRepository.save(new FamilyGroup("첫째집", FIRST_INVITE_CODE));
			FamilyGroup secondGroup = familyGroupRepository.save(new FamilyGroup("둘째집", SECOND_INVITE_CODE));
			groupMemberRepository.save(
				new GroupMember(firstGroup, firstManager, GroupRole.GUARDIAN, true, Instant.now()));
			groupMemberRepository.save(
				new GroupMember(secondGroup, secondManager, GroupRole.GUARDIAN, true, Instant.now()));

			firstGroupId = firstGroup.getId();
			secondGroupId = secondGroup.getId();
			firstManagerUserId = firstManager.getId();
			secondManagerUserId = secondManager.getId();
			targetUserId = target.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentRoleChangesLeaveOneActiveCareReceiverMembership() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long firstMemberId = addGuardianMembership(firstGroupId);
				Long secondMemberId = addGuardianMembership(secondGroupId);
				CountDownLatch start = new CountDownLatch(1);

				Future<Response> first = executor.submit(
					changeRole(start, firstGroupId, firstMemberId, firstManagerUserId));
				Future<Response> second = executor.submit(
					changeRole(start, secondGroupId, secondMemberId, secondManagerUserId));
				start.countDown();

				assertOneSucceedsWithContractedConflict(attempt, first, second);
				discardAttempt();
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 그룹 생성도 같은 제약을 만들 수 있는 세 번째 경로다.
	 *
	 * <p>생성과 역할 변경은 성공 시 상태 코드가 다르고, 어느 쪽이 먼저 커밋되는지에 따라 실패한
	 * 요청의 코드도 달라진다. 따라서 특정 조합을 고정하지 않고 한 요청만 성공하는지, 실패가 서버
	 * 오류가 아닌지, 활성 피보호자가 한 명으로 남는지를 확인한다.
	 */
	@Test
	void concurrentGroupCreationAndRoleChangeLeaveOneActiveCareReceiverMembership() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long memberId = addGuardianMembership(firstGroupId);
				CountDownLatch start = new CountDownLatch(1);

				Future<Response> created = executor.submit(createGroupAsCareReceiver(start));
				Future<Response> changed = executor.submit(
					changeRole(start, firstGroupId, memberId, firstManagerUserId));
				start.countDown();

				Response createResponse = created.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				Response changeResponse = changed.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(createResponse.status(), changeResponse.status()))
					.as("%d번째 시도: 어느 요청도 서버 오류로 끝나면 안 된다", attempt)
					.allSatisfy(statusCode -> assertThat(statusCode).isLessThan(500));
				assertThat(succeeded(createResponse) ^ succeeded(changeResponse))
					.as("%d번째 시도: 생성 %d, 역할 변경 %d — 한 요청만 성공해야 한다",
						attempt, createResponse.status(), changeResponse.status())
					.isTrue();
				assertSingleActiveCareReceiver(attempt);

				discardAttempt();
			}
		} finally {
			shutDown(executor);
		}
	}

	private boolean succeeded(Response response) {
		return response.status() == 200 || response.status() == 201;
	}

	@Test
	void concurrentApprovalsLeaveOneActiveCareReceiverMembership() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long firstRequestId = addPendingRequest(firstGroupId);
				Long secondRequestId = addPendingRequest(secondGroupId);
				CountDownLatch start = new CountDownLatch(1);

				Future<Response> first = executor.submit(
					approve(start, firstGroupId, firstRequestId, firstManagerUserId));
				Future<Response> second = executor.submit(
					approve(start, secondGroupId, secondRequestId, secondManagerUserId));
				start.countDown();

				assertOneSucceedsWithContractedConflict(attempt, first, second);
				discardAttempt();
			}
		} finally {
			shutDown(executor);
		}
	}

	private void assertOneSucceedsWithContractedConflict(
		int attempt,
		Future<Response> first,
		Future<Response> second) throws Exception {
		Response firstResponse = first.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
		Response secondResponse = second.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

		assertThat(List.of(firstResponse.status(), secondResponse.status()))
			.as("%d번째 시도: 한 그룹만 피보호자를 지정할 수 있어야 한다", attempt)
			.containsExactlyInAnyOrder(200, 409);

		String conflictBody = firstResponse.status() == 409 ? firstResponse.body() : secondResponse.body();
		assertThat(conflictBody)
			.as("%d번째 시도: 실패한 요청은 %s로 끝나야 한다", attempt, CONFLICT_CODE)
			.contains(CONFLICT_CODE);

		assertSingleActiveCareReceiver(attempt);
	}

	private void assertSingleActiveCareReceiver(int attempt) {
		transactionTemplate.executeWithoutResult(status -> {
			long careReceiverMemberships = groupMemberRepository.findAllActiveByUserId(targetUserId).stream()
				.filter(membership -> membership.getRole() == GroupRole.CARE_RECEIVER)
				.count();

			assertThat(careReceiverMemberships)
				.as("%d번째 시도: 활성 피보호자 멤버십은 한 건만 남아야 한다", attempt)
				.isEqualTo(1);
		});
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 대상 계정
	 * 행을 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서
	 * 단정하지 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Response> changeRole(CountDownLatch start, Long groupId, Long memberId, Long managerUserId) {
		return () -> {
			start.await();
			return perform(
				"/groups/" + groupId + "/members/" + memberId + "/role", managerUserId, ROLE_BODY);
		};
	}

	private Callable<Response> approve(CountDownLatch start, Long groupId, Long joinRequestId, Long managerUserId) {
		return () -> {
			start.await();
			return perform(
				"/groups/" + groupId + "/join-requests/" + joinRequestId, managerUserId, APPROVE_BODY);
		};
	}

	private Callable<Response> createGroupAsCareReceiver(CountDownLatch start) {
		return () -> {
			start.await();
			var response = mockMvc.perform(post("/groups")
					.with(authenticatedAs(targetUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(CREATE_GROUP_BODY))
				.andReturn()
				.getResponse();
			return new Response(response.getStatus(), response.getContentAsString());
		};
	}

	private Response perform(String path, Long managerUserId, String body) throws Exception {
		var response = mockMvc.perform(patch(path)
				.with(authenticatedAs(managerUserId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andReturn()
			.getResponse();
		return new Response(response.getStatus(), response.getContentAsString());
	}

	private Long addGuardianMembership(Long groupId) {
		return transactionTemplate.execute(status -> groupMemberRepository.save(new GroupMember(
			familyGroupRepository.getReferenceById(groupId),
			userRepository.getReferenceById(targetUserId),
			GroupRole.GUARDIAN,
			false,
			Instant.now())).getId());
	}

	private Long addPendingRequest(Long groupId) {
		return transactionTemplate.execute(status -> groupJoinRequestRepository.save(new GroupJoinRequest(
			familyGroupRepository.getReferenceById(groupId),
			userRepository.getReferenceById(targetUserId),
			JoinRequestStatus.PENDING_ADMIN)).getId());
	}

	/**
	 * 다음 시도가 같은 조건에서 시작하도록 대상자의 멤버십과 가입 요청만 지운다. 관리자 멤버십은
	 * 그룹의 활성 관리자를 유지해야 하므로 남긴다.
	 */
	private void discardAttempt() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteTargetRows("DELETE FROM notifications WHERE receiver_user_id = :targetUserId");
			deleteTargetRows("DELETE FROM group_join_requests WHERE applicant_user_id = :targetUserId");
			deleteGroupsCreatedByTarget();
			deleteTargetRows("DELETE FROM group_members WHERE user_id = :targetUserId");
		});
	}

	private void deleteTargetRows(String deleteStatement) {
		entityManager.createNativeQuery(deleteStatement)
			.setParameter("targetUserId", targetUserId)
			.executeUpdate();
	}

	/**
	 * 대상자가 직접 만든 그룹을 지운다. 초대 코드를 서버가 생성하므로 고정 코드로는 찾을 수 없어
	 * 대상자의 멤버십에서 그룹을 역추적한다. 준비 단계에서도 호출되므로 대상자 id 대신 로그인
	 * id로 찾는다.
	 */
	private void deleteGroupsCreatedByTarget() {
		List<Long> groupIds = groupIdsCreatedByTarget();
		if (groupIds.isEmpty()) {
			return;
		}

		deleteByGroupIds("DELETE FROM notifications", groupIds);
		deleteByGroupIds("DELETE FROM group_join_requests", groupIds);
		deleteByGroupIds("DELETE FROM group_members", groupIds);
		entityManager.createNativeQuery("DELETE FROM family_groups WHERE id in (:groupIds)")
			.setParameter("groupIds", groupIds)
			.executeUpdate();
	}

	private List<Long> groupIdsCreatedByTarget() {
		List<?> rows = entityManager.createNativeQuery("""
				select member.group_id
				from group_members member
				join family_groups groups on groups.id = member.group_id
				join users account on account.id = member.user_id
				where account.login_id = :targetLoginId
				  and groups.invite_code not in (:inviteCodes)
				""")
			.setParameter("targetLoginId", TARGET_LOGIN_ID)
			.setParameter("inviteCodes", INVITE_CODES)
			.getResultList();

		return rows.stream()
			.map(Number.class::cast)
			.map(Number::longValue)
			.toList();
	}

	private void deleteByGroupIds(String deleteClause, List<Long> groupIds) {
		entityManager.createNativeQuery(deleteClause + " WHERE group_id in (:groupIds)")
			.setParameter("groupIds", groupIds)
			.executeUpdate();
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른
	 * 테스트가 남긴 행의 외래 키를 건드릴 수 있다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroups("DELETE FROM notifications");
			deleteByOwnGroups("DELETE FROM group_join_requests");
			deleteGroupsCreatedByTarget();
			deleteByOwnGroups("DELETE FROM group_members");
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code in (:inviteCodes)")
				.setParameter("inviteCodes", INVITE_CODES)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", LOGIN_IDS)
				.executeUpdate();
		});
	}

	private void deleteByOwnGroups(String deleteClause) {
		entityManager.createNativeQuery(deleteClause
				+ " WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code in (:inviteCodes))")
			.setParameter("inviteCodes", INVITE_CODES)
			.executeUpdate();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}

	private record Response(int status, String body) {
	}
}
