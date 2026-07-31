package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

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
 * 같은 가입 요청을 동시에 승인·거절할 때의 상태 정합성을 검증한다.
 *
 * <p>{@code JoinRequestApiTest}와 달리 클래스에 {@code @Transactional}을 붙이지 않는다. 테스트
 * 트랜잭션 안에서는 준비한 데이터가 커밋되지 않아 다른 스레드에서 보이지 않고, 요청도 테스트
 * 트랜잭션에 합류해 경쟁 자체가 재현되지 않는다. 대신 준비와 검증을 각각 커밋되는 트랜잭션으로
 * 나누고 정리는 직접 수행한다.
 *
 * <p>경쟁 구간이 열리는 시점은 보장할 수 없으므로 여러 번 반복한다. 잠금이 없으면 두 트랜잭션이
 * 모두 대기 상태를 읽어, 거절로 끝난 요청에 활성 멤버십이 남는 조합이 나타난다.
 */
@AutoConfigureMockMvc
class JoinRequestDecisionConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long DECISION_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE = "CNC123";
	private static final String MANAGER_LOGIN_ID = "cnc_manager";
	private static final String APPLICANT_LOGIN_ID = "cnc_applicant";
	private static final String APPROVE_BODY = "{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}";
	private static final String REJECT_BODY = "{\"decision\": \"REJECT\"}";

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

	private Long groupId;
	private Long managerUserId;
	private Long applicantUserId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			User manager = userRepository.save(user(MANAGER_LOGIN_ID, "관리자"));
			User applicant = userRepository.save(user(APPLICANT_LOGIN_ID, "신청자"));
			FamilyGroup group = familyGroupRepository.save(new FamilyGroup("우리가족", INVITE_CODE));
			groupMemberRepository.save(new GroupMember(group, manager, GroupRole.GUARDIAN, true, Instant.now()));

			groupId = group.getId();
			managerUserId = manager.getId();
			applicantUserId = applicant.getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentApproveAndRejectKeepStatusAndMembershipConsistent() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Long joinRequestId = createPendingRequest();
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> approve = executor.submit(decision(start, joinRequestId, APPROVE_BODY));
				Future<Integer> reject = executor.submit(decision(start, joinRequestId, REJECT_BODY));
				start.countDown();

				int approveStatus = approve.get(DECISION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int rejectStatus = reject.get(DECISION_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(approveStatus, rejectStatus))
					.as("%d번째 시도: 한 요청만 처리되어야 한다", attempt)
					.containsExactlyInAnyOrder(200, 409);
				assertStateIsConsistent(attempt, joinRequestId);

				discardAttempt(joinRequestId);
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 가입 요청 행을
	 * 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서 단정하지
	 * 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(DECISION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Integer> decision(CountDownLatch start, Long joinRequestId, String body) {
		return () -> {
			start.await();
			return mockMvc.perform(patch("/groups/" + groupId + "/join-requests/" + joinRequestId)
					.with(authenticatedAs(managerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	/**
	 * 거절로 끝난 요청에는 활성 멤버십이 없어야 하고, 승인으로 끝난 요청에는 있어야 한다.
	 */
	private void assertStateIsConsistent(int attempt, Long joinRequestId) {
		transactionTemplate.executeWithoutResult(status -> {
			JoinRequestStatus finalStatus = groupJoinRequestRepository.findById(joinRequestId)
				.orElseThrow()
				.getStatus();
			boolean activeMember = groupMemberRepository
				.findActiveByGroupIdAndUserId(groupId, applicantUserId)
				.isPresent();

			assertThat(finalStatus)
				.as("%d번째 시도: 요청은 승인 또는 거절로 끝나야 한다", attempt)
				.isIn(JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED);
			assertThat(activeMember)
				.as("%d번째 시도: 최종 상태 %s와 활성 멤버십이 어긋난다", attempt, finalStatus)
				.isEqualTo(finalStatus == JoinRequestStatus.APPROVED);
		});
	}

	private Long createPendingRequest() {
		return transactionTemplate.execute(status -> groupJoinRequestRepository.save(new GroupJoinRequest(
			familyGroupRepository.getReferenceById(groupId),
			userRepository.getReferenceById(applicantUserId),
			JoinRequestStatus.PENDING_ADMIN)).getId());
	}

	private void discardAttempt(Long joinRequestId) {
		transactionTemplate.executeWithoutResult(status -> {
			groupJoinRequestRepository.deleteById(joinRequestId);
			groupMemberRepository.findByGroupIdAndUserId(groupId, applicantUserId)
				.ifPresent(groupMemberRepository::delete);
		});
	}

	/**
	 * 이 클래스가 만든 행만 지운다. 커밋하는 테스트라 롤백으로 정리되지 않고, 전체 삭제는 다른 테스트가
	 * 남긴 행의 외래 키를 건드릴 수 있다.
	 */
	private void clearOwnData() {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByOwnGroup("DELETE FROM notifications");
			deleteByOwnGroup("DELETE FROM group_join_requests");
			deleteByOwnGroup("DELETE FROM group_members");
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE invite_code = :inviteCode")
				.setParameter("inviteCode", INVITE_CODE)
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", List.of(MANAGER_LOGIN_ID, APPLICANT_LOGIN_ID))
				.executeUpdate();
		});
	}

	private void deleteByOwnGroup(String deleteClause) {
		entityManager.createNativeQuery(deleteClause
				+ " WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = :inviteCode)")
			.setParameter("inviteCode", INVITE_CODE)
			.executeUpdate();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}
}
