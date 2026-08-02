package com.ssafy.s15p11b104.domain.group;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * 그룹 삭제와 가입 승인이 겹칠 때 승인된 구성원이 함께 지워지지 않는지 검증한다.
 *
 * <p>그룹 행을 잠그지 않으면 삭제가 활성 인원을 확인한 뒤 승인이 커밋되고, 삭제의 그룹 단위 일괄
 * 삭제가 방금 만들어진 멤버십까지 지운다. 승인 200과 삭제 204가 모두 성공하는데 멤버십은 사라지는
 * write-skew다.
 *
 * <p>클래스에 {@code @Transactional}을 붙이지 않는 이유는 준비 데이터가 커밋되어야 다른 스레드에서
 * 보이고, 요청이 테스트 트랜잭션에 합류하면 경쟁이 재현되지 않기 때문이다.
 */
@AutoConfigureMockMvc
class GroupDeletionJoinApprovalConcurrencyTest extends IntegrationTest {

	private static final int ATTEMPTS = 20;
	private static final long REQUEST_TIMEOUT_SECONDS = 5;
	private static final String INVITE_CODE_PREFIX = "GDA";
	private static final String GROUP_NAME = "지울집";
	private static final String MANAGER_LOGIN_ID = "gda_manager";
	private static final String APPLICANT_LOGIN_ID = "gda_applicant";
	private static final List<String> LOGIN_IDS = List.of(MANAGER_LOGIN_ID, APPLICANT_LOGIN_ID);
	private static final String APPROVE_BODY = "{\"decision\": \"APPROVE\", \"assignedRole\": \"GUARDIAN\"}";
	private static final String DELETE_BODY = "{\"confirmationName\": \"" + GROUP_NAME + "\"}";

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

	private Long managerUserId;
	private Long applicantUserId;

	@BeforeEach
	void setUp() {
		clearOwnData();
		transactionTemplate.executeWithoutResult(status -> {
			managerUserId = userRepository.save(user(MANAGER_LOGIN_ID, "관리자")).getId();
			applicantUserId = userRepository.save(user(APPLICANT_LOGIN_ID, "신청자")).getId();
		});
	}

	@AfterEach
	void tearDown() {
		clearOwnData();
	}

	@Test
	void concurrentDeletionAndApprovalNeverBothSucceed() throws Exception {
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
				Fixture fixture = createGroupWithPendingRequest(attempt);
				CountDownLatch start = new CountDownLatch(1);

				Future<Integer> deletion = executor.submit(deleteGroup(start, fixture.groupId()));
				Future<Integer> approval = executor.submit(
					approve(start, fixture.groupId(), fixture.joinRequestId()));
				start.countDown();

				int deletionStatus = deletion.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
				int approvalStatus = approval.get(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);

				assertThat(List.of(deletionStatus, approvalStatus))
					.as("%d번째 시도: 어느 요청도 서버 오류로 끝나면 안 된다", attempt)
					.allSatisfy(statusCode -> assertThat(statusCode).isLessThan(500));
				assertOutcomeIsConsistent(attempt, fixture.groupId(), deletionStatus, approvalStatus);

				discardAttempt(fixture.groupId());
			}
		} finally {
			shutDown(executor);
		}
	}

	/**
	 * 삭제와 승인 중 정확히 하나만 성공해야 하고, 남은 상태가 그 결과와 일치해야 한다.
	 *
	 * <p>둘 다 성공하면 승인된 구성원이 삭제에 휩쓸린 write-skew다.
	 */
	private void assertOutcomeIsConsistent(int attempt, Long groupId, int deletionStatus, int approvalStatus) {
		boolean deleted = deletionStatus == 204;
		boolean approved = approvalStatus == 200;

		assertThat(deleted ^ approved)
			.as("%d번째 시도: 삭제 %d, 승인 %d — 정확히 한 요청만 성공해야 한다",
				attempt, deletionStatus, approvalStatus)
			.isTrue();

		transactionTemplate.executeWithoutResult(status -> {
			long groupRows = count("select count(*) from family_groups where id = :groupId", groupId);
			long activeMembers = count(
				"select count(*) from group_members where group_id = :groupId and left_at is null", groupId);

			if (deleted) {
				assertThat(groupRows)
					.as("%d번째 시도: 삭제가 성공했으면 그룹이 남으면 안 된다", attempt)
					.isZero();
				assertThat(activeMembers)
					.as("%d번째 시도: 삭제가 성공했으면 멤버십이 남으면 안 된다", attempt)
					.isZero();
				return;
			}

			assertThat(groupRows)
				.as("%d번째 시도: 승인이 성공했으면 그룹이 남아야 한다", attempt)
				.isEqualTo(1);
			assertThat(activeMembers)
				.as("%d번째 시도: 승인이 성공했으면 관리자와 신청자가 활성으로 남아야 한다", attempt)
				.isEqualTo(2);
		});
	}

	private long count(String sql, Long groupId) {
		return ((Number) entityManager.createNativeQuery(sql)
			.setParameter("groupId", groupId)
			.getSingleResult()).longValue();
	}

	/**
	 * 남은 요청 스레드가 끝날 때까지 기다린다. 잠금 회귀로 요청이 멈추면 그 트랜잭션이 그룹 행을
	 * 계속 쥐고 있어, 기다리지 않으면 뒤따르는 정리 삭제가 그 잠금을 기다리게 된다. 여기서 단정하지
	 * 않는 것은 본문의 실패 원인을 가리지 않기 위해서다.
	 */
	private void shutDown(ExecutorService executor) throws InterruptedException {
		executor.shutdownNow();
		executor.awaitTermination(REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS);
	}

	private Callable<Integer> deleteGroup(CountDownLatch start, Long groupId) {
		return () -> {
			start.await();
			return mockMvc.perform(delete("/groups/" + groupId)
					.with(authenticatedAs(managerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(DELETE_BODY))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	private Callable<Integer> approve(CountDownLatch start, Long groupId, Long joinRequestId) {
		return () -> {
			start.await();
			return mockMvc.perform(patch("/groups/" + groupId + "/join-requests/" + joinRequestId)
					.with(authenticatedAs(managerUserId))
					.contentType(MediaType.APPLICATION_JSON)
					.content(APPROVE_BODY))
				.andReturn()
				.getResponse()
				.getStatus();
		};
	}

	/**
	 * 시도마다 새 그룹을 만든다. 삭제가 성공한 시도의 그룹은 재사용할 수 없다.
	 */
	private Fixture createGroupWithPendingRequest(int attempt) {
		return transactionTemplate.execute(status -> {
			FamilyGroup group = familyGroupRepository.save(
				new FamilyGroup(GROUP_NAME, INVITE_CODE_PREFIX + String.format("%03d", attempt)));
			groupMemberRepository.save(new GroupMember(
				group,
				userRepository.getReferenceById(managerUserId),
				GroupRole.GUARDIAN,
				true,
				Instant.now()));
			GroupJoinRequest joinRequest = groupJoinRequestRepository.save(new GroupJoinRequest(
				group,
				userRepository.getReferenceById(applicantUserId),
				JoinRequestStatus.PENDING_ADMIN));

			return new Fixture(group.getId(), joinRequest.getId());
		});
	}

	private void discardAttempt(Long groupId) {
		transactionTemplate.executeWithoutResult(status -> {
			entityManager.createNativeQuery("SET LOCAL lock_timeout = '5s'").executeUpdate();
			deleteByGroup("DELETE FROM notifications", groupId);
			deleteByGroup("DELETE FROM group_join_requests", groupId);
			deleteByGroup("DELETE FROM group_members", groupId);
			entityManager.createNativeQuery("DELETE FROM family_groups WHERE id = :groupId")
				.setParameter("groupId", groupId)
				.executeUpdate();
		});
	}

	private void deleteByGroup(String deleteClause, Long groupId) {
		entityManager.createNativeQuery(deleteClause + " WHERE group_id = :groupId")
			.setParameter("groupId", groupId)
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
			deleteByOwnGroups("DELETE FROM group_members");
			entityManager.createNativeQuery(
					"DELETE FROM family_groups WHERE invite_code LIKE :prefix")
				.setParameter("prefix", INVITE_CODE_PREFIX + "%")
				.executeUpdate();
			entityManager.createNativeQuery("DELETE FROM users WHERE login_id in (:loginIds)")
				.setParameter("loginIds", LOGIN_IDS)
				.executeUpdate();
		});
	}

	private void deleteByOwnGroups(String deleteClause) {
		entityManager.createNativeQuery(deleteClause
				+ " WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code LIKE :prefix)")
			.setParameter("prefix", INVITE_CODE_PREFIX + "%")
			.executeUpdate();
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1960, 5, 2), UserGender.FEMALE);
	}

	private record Fixture(Long groupId, Long joinRequestId) {
	}
}
